import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { DbUserProfile } from "@/types/database";

interface AuthStore {
  user:      User | null;
  profile:   DbUserProfile | null;
  isLoading: boolean;

  setUser:    (user: User | null)           => void;
  setProfile: (profile: DbUserProfile | null) => void;
  setLoading: (loading: boolean)            => void;
  reset:      ()                            => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:      null,
  profile:   null,
  isLoading: true,

  setUser:    (user)      => set({ user }),
  setProfile: (profile)   => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  reset:      ()          => set({ user: null, profile: null, isLoading: false }),
}));
