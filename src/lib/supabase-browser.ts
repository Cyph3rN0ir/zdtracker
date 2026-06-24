import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public anon key — safe to embed in browser code. Used only for Realtime
// Broadcast channels (no row reads). All chat data goes through authenticated
// server functions.
const SUPABASE_URL = "https://jprczeqjuhgnaauvsugu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwcmN6ZXFqdWhnbmFhdXZzdWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NTM2NDIsImV4cCI6MjA5NzUyOTY0Mn0.0QJhFsMIMe9D3fLYlWecRUts8x1flzt948WzYziOqSU";

let cached: SupabaseClient | undefined;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}
