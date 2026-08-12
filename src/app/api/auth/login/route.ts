import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { apiOk, apiBadRequest, apiInternalError } from "@/lib/api-response";

// POST /api/auth/login
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    const identifier = (email || "").trim();
    if (!identifier || !password) {
      return apiBadRequest("Email/Nama Lengkap dan password wajib diisi.");
    }

    const supabase = await createSupabaseServer();

    // Jika input mengandung "@" -> email, langsung pakai.
    // Jika tidak -> anggap username (Nama Lengkap), cari email-nya di profil.
    let loginEmail = identifier;
    if (!identifier.includes("@")) {
      const admin = createSupabaseAdmin();
      const { data: profile, error } = await admin
        .from("profiles")
        .select("email")
        .ilike("full_name", identifier)
        .limit(1)
        .maybeSingle();

      if (error || !profile?.email) {
        return apiBadRequest("Nama pengguna tidak ditemukan.");
      }
      loginEmail = profile.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      return apiBadRequest(
        error.message === "Invalid login credentials"
          ? "Email/Nama atau password salah."
          : error.message
      );
    }

    return apiOk({
      user: {
        id: data.user.id,
        email: data.user.email!,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch {
    return apiInternalError();
  }
}
