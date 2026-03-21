import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthInitializer from "@/components/layout/AuthInitializer";
import AppShell from "@/components/layout/AppShell";

/**
 * Server Component layout for all authenticated routes.
 *
 * Why server-side auth check here *and* in middleware?
 * Middleware refreshes the session cookie (required by Supabase SSR) and
 * provides a fast redirect for unauthenticated users. This layout does a
 * second check so that even if the middleware somehow passes through, the
 * page never renders without a valid user — defence in depth.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile — may be null for brand-new users (created during onboarding)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AuthInitializer user={user} profile={profile}>
      <AppShell>{children}</AppShell>
    </AuthInitializer>
  );
}
