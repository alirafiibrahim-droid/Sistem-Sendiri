import { createSupabaseServer } from "@/lib/supabase/server";
import { apiOk, apiBadRequest, apiInternalError, apiTooManyRequests } from "@/lib/api-response";

// POST /api/auth/forgot-password
// Alur "Lupa Password" (aman): user input email -> sistem mengirim link reset
// ke email tersebut -> user membuka link -> mengatur password baru di halaman
// /reset-password -> login dengan password baru.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    const resetEmail = (email || "").trim().toLowerCase();
    if (!resetEmail || !resetEmail.includes("@")) {
      return apiBadRequest("Email wajib diisi dan harus valid.");
    }

    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/api/auth/callback?next=/reset-password`;

    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo,
    });

    if (error) {
      // Supabase memberlakukan rate limit email per-IP (default 30/jam).
      // Tampilkan pesan ramah agar tidak membingungkan pengguna.
      const isRateLimit =
        error.code === "over_email_send_rate_limit" ||
        error.code === "over_request_rate_limit" ||
        /rate\s?limit|over_email_send_rate_limit/i.test(error.message || "");

      if (isRateLimit) {
        return apiTooManyRequests(
          "Terlalu banyak permintaan reset password dalam waktu singkat. Silakan coba lagi sekitar 1 jam lagi."
        );
      }

      return apiInternalError(error.message);
    }

    // Pesan generik agar tidak membocorkan email yang terdaftar
    return apiOk({
      message:
        "Jika email terdaftar, link reset password telah dikirim ke email Anda.",
    });
  } catch {
    return apiInternalError();
  }
}
