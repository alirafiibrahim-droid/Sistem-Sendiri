import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// ============================================================================
// SIORG Proxy
// Handles auth session refresh for every request and attaches user info
// to request headers for downstream API route handlers.
// ============================================================================

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session - ensures cookies are current
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Attach user info to headers for API route handlers
  if (user) {
    supabaseResponse.headers.set("x-user-id", user.id);
    supabaseResponse.headers.set("x-user-email", user.email ?? "");

    // Fetch user role from profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (profile) {
      supabaseResponse.headers.set("x-user-role", profile.role);
      supabaseResponse.headers.set("x-user-status", profile.status);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all API routes:
     * - /api/:path*
     */
    "/api/:path*",
  ],
};
