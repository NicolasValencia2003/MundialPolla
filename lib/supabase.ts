import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client using the SERVICE ROLE key (bypasses RLS).
// This must NEVER be imported into a client component — it stays on the server,
// so the browser only ever talks to our own /api routes.
//
// Created lazily (on first request) rather than at module load, so that a build
// with missing env vars doesn't crash while collecting page data.
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
