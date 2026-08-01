import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const [{ getSupabaseAdmin }, { getSession }, bcrypt] = await Promise.all([
      import("@/lib/supabase.server"),
      import("@/lib/session.server"),
      import("bcryptjs"),
    ]);
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("app_users")
      .select("id, username, password_hash, role, display_name")
      .eq("username", data.username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!user) throw new Error("Invalid username or password");
    const ok = await bcrypt.default.compare(data.password, user.password_hash);
    if (!ok) throw new Error("Invalid username or password");
    const session = await getSession();
    await session.update({
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
    });
    return { ok: true, role: user.role };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getSession } = await import("@/lib/session.server");
  const s = await getSession();
  await s.clear();
  throw redirect({ to: "/auth" });
});

export const meFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession } = await import("@/lib/session.server");
  const s = await getSession();
  if (!s.data.userId) return null;
  return {
    userId: s.data.userId!,
    username: s.data.username!,
    role: s.data.role!,
    displayName: s.data.displayName ?? "",
  };
});

const createUserSchema = z.object({
  username: z.string().trim().min(2).max(64).regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, . _ - only"),
  password: z.string().min(4).max(200),
  role: z.enum(["admin", "owner", "investor", "member"]),
  displayName: z.string().trim().max(120).default(""),
});

export const adminCreateUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data }) => {
    const { getSession } = await import("@/lib/session.server");
    const s = await getSession();
    if (s.data.role !== "admin") throw new Error("Forbidden");
    const [{ getSupabaseAdmin }, bcrypt] = await Promise.all([
      import("@/lib/supabase.server"),
      import("bcryptjs"),
    ]);
    const hash = await bcrypt.default.hash(data.password, 10);
    const { error } = await getSupabaseAdmin().from("app_users").insert({
      username: data.username,
      password_hash: hash,
      role: data.role,
      display_name: data.displayName,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Username already taken");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession } = await import("@/lib/session.server");
  const s = await getSession();
  if (s.data.role !== "admin") throw new Error("Forbidden");
  const { getSupabaseAdmin } = await import("@/lib/supabase.server");
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id, username, role, display_name, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const deleteUserSchema = z.object({ id: z.string().uuid() });
export const adminDeleteUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => deleteUserSchema.parse(d))
  .handler(async ({ data }) => {
    const { getSession } = await import("@/lib/session.server");
    const s = await getSession();
    if (s.data.role !== "admin") throw new Error("Forbidden");
    if (s.data.userId === data.id) throw new Error("Cannot delete yourself");
    const { getSupabaseAdmin } = await import("@/lib/supabase.server");
    const { error } = await getSupabaseAdmin().from("app_users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateUserSchema = z.object({
  id: z.string().uuid(),
  username: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, . _ - only")
    .optional(),
  password: z.string().min(4).max(200).optional().or(z.literal("")),
  displayName: z.string().trim().max(120).optional(),
  role: z.enum(["admin", "owner", "investor", "member"]).optional(),
});
export const adminUpdateUserFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateUserSchema.parse(d))
  .handler(async ({ data }) => {
    const { getSession } = await import("@/lib/session.server");
    const s = await getSession();
    if (s.data.role !== "admin") throw new Error("Forbidden");
    const [{ getSupabaseAdmin }, bcrypt] = await Promise.all([
      import("@/lib/supabase.server"),
      import("bcryptjs"),
    ]);
    const patch: Record<string, any> = {};
    if (data.username) patch.username = data.username;
    if (typeof data.displayName === "string") patch.display_name = data.displayName;
    if (data.role) {
      if (s.data.userId === data.id && data.role !== "admin") {
        throw new Error("Cannot demote yourself");
      }
      patch.role = data.role;
    }
    if (data.password && data.password.length > 0) {
      patch.password_hash = await bcrypt.default.hash(data.password, 10);
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await getSupabaseAdmin().from("app_users").update(patch).eq("id", data.id);
    if (error) {
      if (error.code === "23505") throw new Error("Username already taken");
      throw new Error(error.message);
    }
    return { ok: true };
  });
