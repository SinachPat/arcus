import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Exact public paths (no auth required)
const PUBLIC_EXACT = ["/", "/login", "/signup", "/reset-password"];
// Prefix-matched public paths
const PUBLIC_PREFIXES = ["/auth", "/api/stripe"];
// Auth pages — authenticated users get bounced to /dashboard
const AUTH_EXACT = ["/login", "/signup", "/reset-password"];

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export async function updateSession(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not add any logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Authenticated users visiting login/signup/reset → send to dashboard (or onboarding)
  if (user && AUTH_EXACT.includes(pathname)) {
    const url = request.nextUrl.clone();
    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();

    url.pathname = (profile as { onboarding_completed?: boolean } | null)?.onboarding_completed
      ? "/dashboard"
      : "/onboarding";
    return NextResponse.redirect(url);
  }

  // Unauthenticated users visiting protected routes → send to login
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
