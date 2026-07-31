import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.ZT_SUPABASE_URL ?? "https://jprczeqjuhgnaauvsugu.supabase.co";
  const key = process.env.ZT_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("ZT_SUPABASE_SERVICE_ROLE_KEY is not set");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * True when a PostgREST error means the schema is behind the code: an unknown
 * column (42703) or a table that isn't in the schema cache (PGRST205/PGRST202).
 * Lets reads degrade gracefully until the pending migration is applied instead
 * of blanking out existing data.
 */
export function isMissingSchema(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42703" || e.code === "PGRST205" || e.code === "PGRST202") return true;
  const m = e.message ?? "";
  return /does not exist|schema cache/i.test(m);
}
