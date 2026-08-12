import { createSupabaseServer } from "@/lib/supabase/server";
import { apiOk, apiBadRequest, apiUnauthorized, apiInternalError } from "@/lib/api-response";

// POST /api/auth/change-password
// Mengubah password user yang sedang login. Wajib sesi aktif.
// Admin tidak dapat mengubah password user lain; setiap user hanya
// dapat mengubah password miliknya sendiri.
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiUnauthorized();

    const body = await request.json();
    const { current_password, new_password } = body as {
      current_password?: string;
      new_password?: string;
    };

    if (!current_password || !new_password) {
      return apiBadRequest("Password lama dan password baru wajib diisi.");
    }
    if (new_password.length < 6) {
      return apiBadRequest("Password baru minimal 6 karakter.");
    }

    // Verifikasi password lama sebelum diubah
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    });
    if (signInError) {
      return apiBadRequest("Password lama salah.");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password,
    });
    if (updateError) {
      return apiInternalError(updateError.message);
    }

    return apiOk({ message: "Password berhasil diubah." });
  } catch {
    return apiInternalError();
  }
}
