import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireSession() {
  const { getSession } = await import("@/lib/session.server");
  const s = await getSession();
  if (!s.data.userId) throw new Error("Not signed in");
  return s.data;
}

async function db() {
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  return getSupabaseAdmin();
}

// ---------- Lists ----------

export const listListsFn = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireSession();
  const supa = await db();
  const { data, error } = await supa
    .from("note_lists")
    .select("id, title, color, icon, sort_order, archived_at, created_at, updated_at")
    .eq("user_id", me.userId!)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  // attach open-todo counts + last-updated per list
  const ids = (data ?? []).map((l) => l.id);
  if (ids.length === 0) return [] as any[];
  const { data: counts } = await supa
    .from("todos")
    .select("list_id, done_at")
    .eq("user_id", me.userId!)
    .in("list_id", ids);
  const openByList: Record<string, number> = {};
  (counts ?? []).forEach((t: any) => {
    if (!t.done_at && t.list_id) openByList[t.list_id] = (openByList[t.list_id] || 0) + 1;
  });
  return (data ?? []).map((l) => ({ ...l, open_count: openByList[l.id] || 0 }));
});

export const createListFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(80),
        color: z.string().max(20).optional(),
        icon: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { data: row, error } = await supa
      .from("note_lists")
      .insert({
        user_id: me.userId,
        title: data.title,
        color: data.color ?? "#6366f1",
        icon: data.icon ?? "notebook",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateListFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(80).optional(),
        color: z.string().max(20).optional(),
        icon: z.string().max(40).optional(),
        archived: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.color !== undefined) patch.color = data.color;
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.archived !== undefined) patch.archived_at = data.archived ? new Date().toISOString() : null;
    const { error } = await supa
      .from("note_lists")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteListFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { error } = await supa.from("note_lists").delete().eq("id", data.id).eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Notes ----------

export const listNotesFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ listId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    let q = supa
      .from("notes")
      .select("id, list_id, title, body_md, pinned, updated_at, created_at")
      .eq("user_id", me.userId!)
      .is("archived_at", null)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.listId) q = q.eq("list_id", data.listId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { data: row, error } = await supa
      .from("notes")
      .select("id, list_id, title, body_md, pinned, updated_at, created_at")
      .eq("id", data.id)
      .eq("user_id", me.userId!)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

export const upsertNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        listId: z.string().uuid().nullable().optional(),
        title: z.string().max(200).default(""),
        body_md: z.string().max(50000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    if (data.id) {
      const { error } = await supa
        .from("notes")
        .update({
          title: data.title,
          body_md: data.body_md,
          list_id: data.listId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("user_id", me.userId!);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supa
      .from("notes")
      .insert({
        user_id: me.userId,
        list_id: data.listId ?? null,
        title: data.title,
        body_md: data.body_md,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const togglePinNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { error } = await supa
      .from("notes")
      .update({ pinned: data.pinned, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNoteFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { error } = await supa.from("notes").delete().eq("id", data.id).eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Todos ----------

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

export const listTodosFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        from: z.string().regex(DATE_RX).optional(),
        to: z.string().regex(DATE_RX).optional(),
        listId: z.string().uuid().nullable().optional(),
        noteId: z.string().uuid().nullable().optional(),
        includeUnscheduled: z.boolean().default(false),
        includeOverdue: z.boolean().default(false),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();

    // Three potential buckets: dated range, overdue (open + before from), unscheduled
    const cols = "id, list_id, note_id, title, details, due_date, done_at, priority, sort_order, updated_at, created_at";

    const out: any[] = [];

    if (data.from && data.to) {
      let q = supa
        .from("todos")
        .select(cols)
        .eq("user_id", me.userId!)
        .gte("due_date", data.from)
        .lte("due_date", data.to);
      if (data.listId) q = q.eq("list_id", data.listId);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      out.push(...(rows ?? []));
    } else if (data.listId !== undefined || data.noteId !== undefined) {
      let q = supa.from("todos").select(cols).eq("user_id", me.userId!);
      if (data.listId) q = q.eq("list_id", data.listId);
      if (data.noteId) q = q.eq("note_id", data.noteId);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      out.push(...(rows ?? []));
    }

    if (data.includeOverdue && data.from) {
      let q = supa
        .from("todos")
        .select(cols)
        .eq("user_id", me.userId!)
        .lt("due_date", data.from)
        .is("done_at", null);
      if (data.listId) q = q.eq("list_id", data.listId);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      out.push(...(rows ?? []));
    }

    if (data.includeUnscheduled) {
      let q = supa.from("todos").select(cols).eq("user_id", me.userId!).is("due_date", null);
      if (data.listId) q = q.eq("list_id", data.listId);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      out.push(...(rows ?? []));
    }

    // Dedupe by id
    const map = new Map<string, any>();
    out.forEach((t) => map.set(t.id, t));
    return Array.from(map.values());
  });

export const createTodoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        details: z.string().max(2000).default(""),
        dueDate: z.string().regex(DATE_RX).nullable().optional(),
        listId: z.string().uuid().nullable().optional(),
        noteId: z.string().uuid().nullable().optional(),
        priority: z.number().int().min(0).max(3).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { data: row, error } = await supa
      .from("todos")
      .insert({
        user_id: me.userId,
        title: data.title,
        details: data.details,
        due_date: data.dueDate ?? null,
        list_id: data.listId ?? null,
        note_id: data.noteId ?? null,
        priority: data.priority,
      })
      .select("id, list_id, note_id, title, details, due_date, done_at, priority, sort_order, updated_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTodoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        details: z.string().max(2000).optional(),
        dueDate: z.string().regex(DATE_RX).nullable().optional(),
        listId: z.string().uuid().nullable().optional(),
        priority: z.number().int().min(0).max(3).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.details !== undefined) patch.details = data.details;
    if (data.dueDate !== undefined) patch.due_date = data.dueDate;
    if (data.listId !== undefined) patch.list_id = data.listId;
    if (data.priority !== undefined) patch.priority = data.priority;
    const { error } = await supa.from("todos").update(patch).eq("id", data.id).eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTodoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { error } = await supa
      .from("todos")
      .update({ done_at: data.done ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTodoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const me = await requireSession();
    const supa = await db();
    const { error } = await supa.from("todos").delete().eq("id", data.id).eq("user_id", me.userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
