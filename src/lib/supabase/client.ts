import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a browser-safe Supabase client.
 * This client uses the browser's fetch API and is authenticated using cookies.
 */
export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Export a default singleton client for simple client-side triggers
export const supabase = createSupabaseClient();
