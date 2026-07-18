import { createSupabaseServer } from "@/lib/supabase/server";
import { apiOk, apiBadRequest } from "@/lib/api-response";

// GET /api/auth/callback?code=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return apiBadRequest("Code parameter tidak ditemukan.");
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return apiBadRequest(error.message);
  }

  return apiOk({ message: "Email verifikasi berhasil. Silakan login." });
}
