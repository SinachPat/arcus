"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import type { User } from "@supabase/supabase-js";
import type { DbUserProfile } from "@/types/database";

interface Props {
  user:     User;
  profile:  DbUserProfile | null;
  children: React.ReactNode;
}

/**
 * Server → client bridge: receives the auth data fetched in the server
 * component layout and hydrates the Zustand auth store once on mount.
 * This avoids a client-side round-trip for the initial session.
 */
export default function AuthInitializer({ user, profile, children }: Props) {
  const { setUser, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    setUser(user);
    setProfile(profile);
    setLoading(false);
  }, [user, profile, setUser, setProfile, setLoading]);

  return <>{children}</>;
}
