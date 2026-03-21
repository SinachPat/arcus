"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./router";

/** tRPC React hooks — use inside Client Components. */
export const trpc = createTRPCReact<AppRouter>();
