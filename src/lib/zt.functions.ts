import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireSession() {
  const { getSession } = await import("@/lib/session.server");
  const s = await getSession();
  if (!s.data.userId) throw new Error("Not signed in");
  return s.data;
}

async function requireAdmin() {
  const me = await requireSession();
  if (me.role !== "admin") throw new Error("Forbidden");
  return me;
}

// ---------- Businesses ----------
export const listBusinessesFn = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireSession();
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const supa = getSupabaseAdmin();
  if (me.role === "admin") {
    const { data, error } = await supa
      .from("businesses")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  const { data: mems, error: e1 } = await supa
    .from("business_members")
    .select("business_id")
    .eq("user_id", me.userId!);
  if (e1) throw new Error(e1.message);
  const ids = (mems ?? []).map((m) => m.business_id);
  if (ids.length === 0) return [];
  const { data, error } = await supa
    .from("businesses")
    .select("id, name, created_at")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createBusinessFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireAdmin();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { data: row, error } = await getSupabaseAdmin()
      .from("businesses")
      .insert({ name: data.name, created_by: me.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getBusinessFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { data: row, error } = await getSupabaseAdmin()
      .from("businesses")
      .select("id, name, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Business not found");
    return row;
  });

export const deleteBusinessFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    // FKs on business_members, business_transactions, tasks all use
    // ON DELETE CASCADE, so removing the business cleans everything up.
    const { error } = await getSupabaseAdmin().from("businesses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameBusinessFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin()
      .from("businesses")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Members ----------
export const listMembersFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { data: mems, error } = await supa
      .from("business_members")
      .select("id, user_id, role_in_business, created_at")
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((mems ?? []).map((m) => m.user_id)));
    let usersById: Record<string, { username: string; display_name: string; role: string }> = {};
    if (ids.length) {
      const { data: us, error: e2 } = await supa
        .from("app_users")
        .select("id, username, display_name, role")
        .in("id", ids);
      if (e2) throw new Error(e2.message);
      usersById = Object.fromEntries((us ?? []).map((u) => [u.id, u]));
    }
    return (mems ?? []).map((m) => ({ ...m, user: usersById[m.user_id] ?? null }));
  });

export const addMemberFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["owner", "investor", "member"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin().from("business_members").insert({
      business_id: data.businessId,
      user_id: data.userId,
      role_in_business: data.role,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });

export const removeMemberFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin().from("business_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Business transactions ----------
export const listTransactionsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { data: tx, error } = await supa
      .from("business_transactions")
      .select("id, kind, amount, party_user_id, note, occurred_on, created_at")
      .eq("business_id", data.businessId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((tx ?? []).map((t) => t.party_user_id).filter(Boolean) as string[]));
    let usersById: Record<string, { username: string; display_name: string }> = {};
    if (ids.length) {
      const { data: us } = await supa.from("app_users").select("id, username, display_name").in("id", ids);
      usersById = Object.fromEntries((us ?? []).map((u) => [u.id, u]));
    }
    return (tx ?? []).map((t) => ({ ...t, party: t.party_user_id ? usersById[t.party_user_id] ?? null : null }));
  });

export const addTransactionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        kind: z.enum(["investment", "earning", "expense", "profit_distribution"]),
        amount: z.number().nonnegative(),
        partyUserId: z.string().uuid().nullable().optional(),
        note: z.string().max(500).default(""),
        occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin().from("business_transactions").insert({
      business_id: data.businessId,
      kind: data.kind,
      amount: data.amount,
      party_user_id: data.partyUserId ?? null,
      note: data.note,
      occurred_on: data.occurredOn,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTransactionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin().from("business_transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Personal profiles ----------
export const listPersonalProfilesFn = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireSession();
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const { data, error } = await getSupabaseAdmin()
    .from("personal_profiles")
    .select("id, name, created_at")
    .eq("owner_user_id", me.userId!)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createPersonalProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { data: row, error } = await getSupabaseAdmin()
      .from("personal_profiles")
      .insert({ owner_user_id: me.userId, name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePersonalProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    // Ownership check before delete
    const { data: prof, error: pErr } = await supa
      .from("personal_profiles")
      .select("id, owner_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prof || prof.owner_user_id !== me.userId) throw new Error("Not found");
    // FKs on personal_* tables cascade from profile_id.
    const { error } = await supa.from("personal_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPersonalProfileFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { data: row, error } = await getSupabaseAdmin()
      .from("personal_profiles")
      .select("id, name, owner_user_id, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.owner_user_id !== me.userId) throw new Error("Not found");
    return row;
  });

export const listPersonalTxFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { data: prof } = await supa
      .from("personal_profiles")
      .select("owner_user_id")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!prof || prof.owner_user_id !== me.userId) throw new Error("Not found");
    const { data: tx, error } = await supa
      .from("personal_transactions")
      .select("id, kind, amount, note, occurred_on, created_at")
      .eq("profile_id", data.profileId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return tx ?? [];
  });

export const addPersonalTxFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        profileId: z.string().uuid(),
        kind: z.enum(["earning", "expense", "debt", "repayment"]),
        amount: z.number().nonnegative(),
        note: z.string().max(500).default(""),
        occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { data: prof } = await supa
      .from("personal_profiles")
      .select("owner_user_id")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!prof || prof.owner_user_id !== me.userId) throw new Error("Not found");
    const { error } = await supa.from("personal_transactions").insert({
      profile_id: data.profileId,
      kind: data.kind,
      amount: data.amount,
      note: data.note,
      occurred_on: data.occurredOn,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePersonalTxFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { data: prof } = await supa
      .from("personal_profiles")
      .select("owner_user_id")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!prof || prof.owner_user_id !== me.userId) throw new Error("Not found");
    const { error } = await supa.from("personal_transactions").delete().eq("id", data.id).eq("profile_id", data.profileId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Tasks ----------
export const listBusinessTasksFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ businessId: z.string().uuid(), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const start = new Date(data.weekStart + "T00:00:00Z");
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    const { data: tasks, error } = await supa
      .from("tasks")
      .select("id, assignee_user_id, title, details, due_date, status")
      .eq("business_id", data.businessId)
      .gte("due_date", data.weekStart)
      .lt("due_date", endStr)
      .order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return tasks ?? [];
  });

export const myTasksFn = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireSession();
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date();
  in14.setDate(in14.getDate() + 14);
  const admin = getSupabaseAdmin();
  // Upcoming window: today .. today+14
  const upcoming = await admin
    .from("tasks")
    .select("id, business_id, title, details, due_date, status, created_by, remark, remark_at")
    .eq("assignee_user_id", me.userId!)
    .gte("due_date", today)
    .lte("due_date", in14.toISOString().slice(0, 10))
    .order("due_date", { ascending: true });
  if (upcoming.error) throw new Error(upcoming.error.message);
  // Overdue: due before today and still not done
  const overdue = await admin
    .from("tasks")
    .select("id, business_id, title, details, due_date, status, created_by, remark, remark_at")
    .eq("assignee_user_id", me.userId!)
    .lt("due_date", today)
    .neq("status", "done")
    .order("due_date", { ascending: true });
  if (overdue.error) throw new Error(overdue.error.message);
  return [...(overdue.data ?? []), ...(upcoming.data ?? [])];
});


export const createTaskFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        assigneeUserId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        details: z.string().max(1000).default(""),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    // Non-admin/owner users can only create tasks assigned to themselves.
    const canAssignOthers = me.role === "admin" || me.role === "owner";
    const assignee = canAssignOthers ? data.assigneeUserId : me.userId!;
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin().from("tasks").insert({
      business_id: data.businessId,
      assignee_user_id: assignee,
      title: data.title,
      details: data.details,
      due_date: data.dueDate,
      created_by: me.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTaskFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { data: t } = await supa.from("tasks").select("assignee_user_id").eq("id", data.id).maybeSingle();
    if (!t) throw new Error("Task not found");
    // Only the assignee can mark their own task complete.
    if (t.assignee_user_id !== me.userId) {
      throw new Error("Only the assignee can change this task's status");
    }
    const { error } = await supa
      .from("tasks")
      .update({ status: data.done ? "done" : "pending", completed_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTaskFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    // The task's creator, the assignee, or an admin/owner may delete it.
    const { data: t, error: readErr } = await supa
      .from("tasks")
      .select("created_by, assignee_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!t) throw new Error("Task not found");
    const isPrivileged = me.role === "admin" || me.role === "owner";
    const isCreator = t.created_by === me.userId;
    const isAssignee = t.assignee_user_id === me.userId;
    if (!isPrivileged && !isCreator && !isAssignee) {
      throw new Error("You don't have permission to delete this task");
    }
    const { error } = await supa.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Assignee adds/edits a remark explaining status (e.g. why it's not done yet).
// Pass `remark: ""` to clear it.
export const setTaskRemarkFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), remark: z.string().max(1000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const supa = getSupabaseAdmin();
    const { data: t, error: readErr } = await supa
      .from("tasks")
      .select("assignee_user_id, created_by")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!t) throw new Error("Task not found");
    // Assignee, creator, or privileged roles may write a remark.
    const isPrivileged = me.role === "admin" || me.role === "owner";
    if (!isPrivileged && t.assignee_user_id !== me.userId && t.created_by !== me.userId) {
      throw new Error("You don't have permission to remark on this task");
    }
    const trimmed = data.remark.trim();
    const { error } = await supa
      .from("tasks")
      .update({
        remark: trimmed === "" ? null : trimmed,
        remark_at: trimmed === "" ? null : new Date().toISOString(),
        remark_by: trimmed === "" ? null : me.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =====================================================================
// Personal finance — accounts, categories, counterparties, loans,
// budgets, extended transactions, dashboard.
// =====================================================================

async function assertProfileOwner(profileId: string) {
  const me = await requireSession();
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const supa = getSupabaseAdmin();
  const { data: prof } = await supa
    .from("personal_profiles")
    .select("owner_user_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!prof || prof.owner_user_id !== me.userId) throw new Error("Not found");
  return { me, supa };
}

// ---------- Accounts ----------
export const listPersonalAccountsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supa } = await assertProfileOwner(data.profileId);
    const { data: rows, error } = await supa
      .from("personal_accounts")
      .select("id, name, type, opening_balance, currency, archived, created_at")
      .eq("profile_id", data.profileId)
      .order("archived")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPersonalAccountFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      profileId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      type: z.enum(["cash", "bank", "wallet", "card", "investment", "savings", "other"]),
      openingBalance: z.number().default(0),
      currency: z.string().trim().min(1).max(8).default("BDT"),
      archived: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const payload = {
      owner_user_id: me.userId,
      profile_id: data.profileId,
      name: data.name,
      type: data.type,
      opening_balance: data.openingBalance,
      currency: data.currency,
      archived: data.archived,
    };
    const q = data.id
      ? supa.from("personal_accounts").update(payload).eq("id", data.id).eq("owner_user_id", me.userId!)
      : supa.from("personal_accounts").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePersonalAccountFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { error } = await supa.from("personal_accounts").delete().eq("id", data.id).eq("owner_user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Categories ----------
const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense"; color: string; icon: string }[] = [
  { name: "Food",          kind: "expense", color: "#ef4444", icon: "utensils" },
  { name: "Groceries",     kind: "expense", color: "#f59e0b", icon: "shopping-basket" },
  { name: "Transport",     kind: "expense", color: "#06b6d4", icon: "car" },
  { name: "Rent",          kind: "expense", color: "#8b5cf6", icon: "home" },
  { name: "Utilities",     kind: "expense", color: "#0ea5e9", icon: "plug" },
  { name: "Shopping",      kind: "expense", color: "#ec4899", icon: "shopping-bag" },
  { name: "Health",        kind: "expense", color: "#10b981", icon: "heart-pulse" },
  { name: "Entertainment", kind: "expense", color: "#a855f7", icon: "film" },
  { name: "Subscriptions", kind: "expense", color: "#6366f1", icon: "repeat" },
  { name: "Education",     kind: "expense", color: "#22c55e", icon: "graduation-cap" },
  { name: "Gifts",         kind: "expense", color: "#f43f5e", icon: "gift" },
  { name: "Other",         kind: "expense", color: "#64748b", icon: "circle" },
  { name: "Salary",        kind: "income",  color: "#16a34a", icon: "wallet" },
  { name: "Freelance",     kind: "income",  color: "#0d9488", icon: "briefcase" },
  { name: "Interest",      kind: "income",  color: "#0284c7", icon: "percent" },
  { name: "Refund",        kind: "income",  color: "#65a30d", icon: "rotate-ccw" },
  { name: "Other income",  kind: "income",  color: "#475569", icon: "circle" },
];

export const listPersonalCategoriesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { data: rows, error } = await supa
      .from("personal_categories")
      .select("id, name, kind, color, icon, archived")
      .eq("profile_id", data.profileId)
      .order("kind")
      .order("name");
    if (error) throw new Error(error.message);
    if ((rows ?? []).length === 0) {
      const seed = DEFAULT_CATEGORIES.map((c) => ({
        owner_user_id: me.userId,
        profile_id: data.profileId,
        ...c,
      }));
      const { error: e2 } = await supa.from("personal_categories").insert(seed);
      if (e2) throw new Error(e2.message);
      const { data: rows2 } = await supa
        .from("personal_categories")
        .select("id, name, kind, color, icon, archived")
        .eq("profile_id", data.profileId)
        .order("kind")
        .order("name");
      return rows2 ?? [];
    }
    return rows ?? [];
  });

export const upsertPersonalCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      profileId: z.string().uuid(),
      name: z.string().trim().min(1).max(60),
      kind: z.enum(["income", "expense"]),
      color: z.string().trim().min(1).max(16).default("#6366f1"),
      icon: z.string().trim().min(1).max(40).default("circle"),
      archived: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const payload = {
      owner_user_id: me.userId,
      profile_id: data.profileId,
      name: data.name,
      kind: data.kind,
      color: data.color,
      icon: data.icon,
      archived: data.archived,
    };
    const q = data.id
      ? supa.from("personal_categories").update(payload).eq("id", data.id).eq("owner_user_id", me.userId!)
      : supa.from("personal_categories").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePersonalCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { error } = await supa.from("personal_categories").delete().eq("id", data.id).eq("owner_user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Counterparties ----------
export const listPersonalCounterpartiesFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supa } = await assertProfileOwner(data.profileId);
    const { data: rows, error } = await supa
      .from("personal_counterparties")
      .select("id, name, kind, note, created_at")
      .eq("profile_id", data.profileId)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPersonalCounterpartyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      profileId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      kind: z.enum(["person", "vendor", "employer", "other"]).default("person"),
      note: z.string().max(300).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const payload = {
      owner_user_id: me.userId,
      profile_id: data.profileId,
      name: data.name,
      kind: data.kind,
      note: data.note,
    };
    const q = data.id
      ? supa.from("personal_counterparties").update(payload).eq("id", data.id).eq("owner_user_id", me.userId!)
      : supa.from("personal_counterparties").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePersonalCounterpartyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { error } = await supa.from("personal_counterparties").delete().eq("id", data.id).eq("owner_user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Loans ----------
export const listPersonalLoansFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supa } = await assertProfileOwner(data.profileId);
    const { data: rows, error } = await supa
      .from("personal_loans")
      .select("id, direction, counterparty_id, principal, interest_rate, started_on, due_on, status, note, created_at")
      .eq("profile_id", data.profileId)
      .order("status")
      .order("started_on", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPersonalLoanFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      profileId: z.string().uuid(),
      direction: z.enum(["i_owe", "owed_to_me"]),
      counterpartyId: z.string().uuid().nullable().optional(),
      principal: z.number().nonnegative(),
      interestRate: z.number().min(0).max(999).default(0),
      startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      status: z.enum(["open", "closed"]).default("open"),
      note: z.string().max(500).default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const payload = {
      owner_user_id: me.userId,
      profile_id: data.profileId,
      direction: data.direction,
      counterparty_id: data.counterpartyId ?? null,
      principal: data.principal,
      interest_rate: data.interestRate,
      started_on: data.startedOn,
      due_on: data.dueOn ?? null,
      status: data.status,
      note: data.note,
    };
    const q = data.id
      ? supa.from("personal_loans").update(payload).eq("id", data.id).eq("owner_user_id", me.userId!)
      : supa.from("personal_loans").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePersonalLoanFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { error } = await supa.from("personal_loans").delete().eq("id", data.id).eq("owner_user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Budgets ----------
export const listPersonalBudgetsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supa } = await assertProfileOwner(data.profileId);
    const { data: rows, error } = await supa
      .from("personal_budgets")
      .select("id, name, period, amount, category_id, start_date, active, created_at")
      .eq("profile_id", data.profileId)
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPersonalBudgetFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      profileId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      period: z.enum(["week", "month"]),
      amount: z.number().nonnegative(),
      categoryId: z.string().uuid().nullable().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const payload = {
      owner_user_id: me.userId,
      profile_id: data.profileId,
      name: data.name,
      period: data.period,
      amount: data.amount,
      category_id: data.categoryId ?? null,
      start_date: data.startDate,
      active: data.active,
    };
    const q = data.id
      ? supa.from("personal_budgets").update(payload).eq("id", data.id).eq("owner_user_id", me.userId!)
      : supa.from("personal_budgets").insert(payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePersonalBudgetFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { error } = await supa.from("personal_budgets").delete().eq("id", data.id).eq("owner_user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Transactions (extended) ----------
const TX_KINDS = [
  "income", "expense", "transfer",
  "investment_buy", "investment_sell",
  "savings_deposit", "savings_withdraw",
  "loan_given", "loan_taken",
  "repayment_in", "repayment_out",
] as const;

export const listPersonalTxExFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      profileId: z.string().uuid(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.number().int().min(1).max(10000).default(5000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supa } = await assertProfileOwner(data.profileId);
    let q = supa
      .from("personal_transactions")
      .select("id, kind, amount, note, occurred_on, created_at, account_id, category_id, counterparty_id, transfer_account_id, linked_loan_id")
      .eq("profile_id", data.profileId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.from) q = q.gte("occurred_on", data.from);
    if (data.to)   q = q.lte("occurred_on", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addPersonalTxExFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      profileId: z.string().uuid(),
      kind: z.enum(TX_KINDS),
      amount: z.number().nonnegative(),
      note: z.string().max(500).default(""),
      occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      accountId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      counterpartyId: z.string().uuid().nullable().optional(),
      transferAccountId: z.string().uuid().nullable().optional(),
      linkedLoanId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { error } = await supa.from("personal_transactions").insert({
      owner_user_id: me.userId,
      profile_id: data.profileId,
      kind: data.kind,
      amount: data.amount,
      note: data.note,
      occurred_on: data.occurredOn,
      account_id: data.accountId ?? null,
      category_id: data.categoryId ?? null,
      counterparty_id: data.counterpartyId ?? null,
      transfer_account_id: data.transferAccountId ?? null,
      linked_loan_id: data.linkedLoanId ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePersonalTxFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      profileId: z.string().uuid(),
      kind: z.enum(TX_KINDS),
      amount: z.number().nonnegative(),
      note: z.string().max(500).default(""),
      occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      accountId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      counterpartyId: z.string().uuid().nullable().optional(),
      transferAccountId: z.string().uuid().nullable().optional(),
      linkedLoanId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { me, supa } = await assertProfileOwner(data.profileId);
    const { error } = await supa.from("personal_transactions").update({
      kind: data.kind,
      amount: data.amount,
      note: data.note,
      occurred_on: data.occurredOn,
      account_id: data.accountId ?? null,
      category_id: data.categoryId ?? null,
      counterparty_id: data.counterpartyId ?? null,
      transfer_account_id: data.transferAccountId ?? null,
      linked_loan_id: data.linkedLoanId ?? null,
    }).eq("id", data.id).eq("profile_id", data.profileId).eq("owner_user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
