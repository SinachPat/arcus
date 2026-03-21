import { createClient } from "@/lib/supabase/server";
import type { User, SupabaseClient } from "@supabase/supabase-js";

export interface Context {
  user: User | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
}

export async function createContext(): Promise<Context> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cast to SupabaseClient<any> — our hand-authored Database type doesn't
  // fully satisfy supabase-js's GenericDatabase constraint, causing column
  // queries in router procedures to infer as never. Using any preserves all
  // runtime behaviour while allowing tRPC routers to query freely.
  return { user, supabase: supabase as SupabaseClient<any> };
}
