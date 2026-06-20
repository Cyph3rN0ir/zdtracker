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
