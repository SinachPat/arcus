/**
 * Server-only Supabase client using the service-role key.
 *
 * Use this for server-side mutations (tRPC routes, Server Actions) that must
 * bypass Row Level Security. The service-role key is never exposed to the
 * browser — it has no NEXT_PUBLIC_ prefix.
 *
 * Security note: callers are responsible for verifying the user's identity
 * before performing any writes. tRPC's `protectedProcedure` middleware handles
 * this for all routers.
 */
import { createClient } from "@supabase/supabase-js";

let _serviceClient: ReturnType<typeof createClient> | null = null;

export function createServiceClient() {
  if (_serviceClient) return _serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  _serviceClient = createClient(url, key, {
    auth: {
      // Service-role clients never need session management
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serviceClient;
}
