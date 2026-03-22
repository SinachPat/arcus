import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run proxy on all paths EXCEPT:
     * - /api/* — tRPC and other API routes handle auth themselves via
     *   protectedProcedure; running session-check proxy on them causes POST
     *   requests to be wrongly redirected to /login when getUser() is slow.
     * - /_next/static, /_next/image — Next.js internals
     * - /favicon.ico and static media extensions
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
