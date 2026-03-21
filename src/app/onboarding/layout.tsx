import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Component layout for the onboarding wizard.
 *
 * - Auth-gated: unauthenticated users are redirected to /login.
 * - Already-onboarded users are bounced to /dashboard.
 * - No AppShell — the wizard is a full-screen immersive experience.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If user already completed onboarding, skip to dashboard
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if ((profile as { onboarding_completed?: boolean } | null)?.onboarding_completed) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
