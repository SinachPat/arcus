import { create } from "zustand";
import type { XPGain, StreakUpdate, BadgeEarned } from "@/types";

interface GamificationState {
  // Persisted values (mirrored from server)
  xp:            number;
  level:         number;
  currentStreak: number;
  streakShields: number;

  // Optimistic in-flight gains (shown in UI before server confirms)
  pendingXP:     number;

  // Toast queue for badges earned this session
  badgeQueue:    BadgeEarned[];

  // Last streak update (for UI animation)
  lastStreakUpdate: StreakUpdate | null;

  // ---- Actions ----

  /** Sync base state from server (called after server mutation). */
  syncFromServer: (data: {
    xp: number;
    level: number;
    currentStreak: number;
    streakShields: number;
  }) => void;

  /** Optimistically add XP before server confirms. */
  addOptimisticXP: (gain: XPGain) => void;

  /** Clear pending XP (call after server confirms, using real value). */
  clearPendingXP: () => void;

  /** Push a badge to the toast queue. */
  enqueueBadge: (badge: BadgeEarned) => void;

  /** Dequeue the oldest badge (call after toast is shown). */
  dequeueBadge: () => void;

  /** Record a streak update for UI animation. */
  applyStreakUpdate: (update: StreakUpdate) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
  xp:            0,
  level:         1,
  currentStreak: 0,
  streakShields: 0,
  pendingXP:     0,
  badgeQueue:    [],
  lastStreakUpdate: null,

  syncFromServer: ({ xp, level, currentStreak, streakShields }) =>
    set({ xp, level, currentStreak, streakShields, pendingXP: 0 }),

  addOptimisticXP: (gain) =>
    set((s) => ({ pendingXP: s.pendingXP + gain.total })),

  clearPendingXP: () =>
    set({ pendingXP: 0 }),

  enqueueBadge: (badge) =>
    set((s) => ({ badgeQueue: [...s.badgeQueue, badge] })),

  dequeueBadge: () =>
    set((s) => ({ badgeQueue: s.badgeQueue.slice(1) })),

  applyStreakUpdate: (update) =>
    set({ lastStreakUpdate: update, currentStreak: update.newStreak }),
}));
