import { createSupabaseServer } from "@/lib/supabase/server";
import { apiOk, apiInternalError } from "@/lib/api-response";

// POST /api/auth/logout
export async function POST() {
  try {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    return apiOk({ message: "Berhasil logout." });
  } catch {
    return apiInternalError();
  }
}
