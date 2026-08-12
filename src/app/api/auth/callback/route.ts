import { createSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/auth/callback?code=...&next=...
// Menukar kode OTP/PKCE menjadi sesi, lalu mengarahkan ke halaman berikutnya.
// Dipakai untuk: verifikasi email & link reset password.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const origin = new URL(request.url).origin;

  // Hindari open redirect: hanya izinkan path internal (tanpa "//")
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
