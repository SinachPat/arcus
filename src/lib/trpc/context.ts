import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { User, SupabaseClient } from "@supabase/supabase-js";

export interface Context {
  user: User | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
}

export async function createContext(): Promise<Context> {
  // Use the anon client only to resolve the authenticated user from the
  // session cookie. All DB reads/writes use the service-role client, which
  // bypasses RLS. tRPC's protectedProcedure middleware is the auth gate.
  const anonClient = await createClient();
  const {
    data: { user },
  } = await anonClient.auth.getUser();

  // Service-role client: bypasses RLS so writes never silently return 0 rows
  // due to a missing or mismatched policy. Safe here because every route that
  // writes data is wrapped in protectedProcedure (verified user required).
  const supabase = createServiceClient() as SupabaseClient<any>;

  return { user, supabase };
}
