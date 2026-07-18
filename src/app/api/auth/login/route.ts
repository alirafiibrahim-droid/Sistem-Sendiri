import { createSupabaseServer } from "@/lib/supabase/server";
import { apiOk, apiBadRequest, apiInternalError } from "@/lib/api-response";
import type { LoginRequest } from "@/lib/types/api";

// POST /api/auth/login
export async function POST(request: Request) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return apiBadRequest("Email dan password wajib diisi.");
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return apiBadRequest(
        error.message === "Invalid login credentials"
          ? "Email atau password salah."
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
