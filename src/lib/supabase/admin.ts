import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client dengan SERVICE ROLE key.
 * Mem-BYPASS RLS — hanya boleh dipakai di Route Handler / Server Action.
 * Digunakan untuk operasi lintas-role yang tidak bisa dijangkau policy RLS,
 * misalnya membaca periode Sertijab yang sedang aktif untuk form Program Kerja.
 */
export function createSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.");
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return adminClient;
}
