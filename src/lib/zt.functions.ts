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
    const { error } = await supa.from("personal_transactions").delete().eq("id", data.id);
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
  const { data, error } = await getSupabaseAdmin()
    .from("tasks")
    .select("id, business_id, title, details, due_date, status")
    .eq("assignee_user_id", me.userId!)
    .gte("due_date", today)
    .lte("due_date", in14.toISOString().slice(0, 10))
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
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
    // Only admins can delete tasks.
    if (me.role !== "admin") throw new Error("Only admins can delete tasks");
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin().from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
