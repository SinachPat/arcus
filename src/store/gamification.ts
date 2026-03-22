import { create } from "zustand";
import type { XPGain, StreakUpdate, BadgeEarned } from "@/types";

export interface XPEvent {
  id: string;
  amount: number;
  position?: { x: number; y: number };
}

interface GamificationState {
  xp:            number;
  level:         number;
  currentStreak: number;
  streakShields: number;
  pendingXP:     number;

  xpEvents:      XPEvent[];
  levelUpEvent:  { level: number; title: string } | null;
  badgeEvents:   BadgeEarned[];
  streakEvent:   { days: number } | null;

  badgeQueue:    BadgeEarned[];
  lastStreakUpdate: StreakUpdate | null;

  syncFromServer: (data: { xp: number; level: number; currentStreak: number; streakShields: number }) => void;
  addOptimisticXP: (gain: XPGain) => void;
  clearPendingXP: () => void;

  addXPEvent: (amount: number, position?: { x: number; y: number }) => void;
  clearXPEvent: (id: string) => void;
  setLevelUpEvent: (event: { level: number; title: string } | null) => void;
  addBadgeEvent: (badge: BadgeEarned) => void;
  clearBadgeEvent: (badgeId: string) => void;
  setStreakEvent: (event: { days: number } | null) => void;

  enqueueBadge: (badge: BadgeEarned) => void;
  dequeueBadge: () => void;
  applyStreakUpdate: (update: StreakUpdate) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
  xp: 0, level: 1, currentStreak: 0, streakShields: 0, pendingXP: 0,
  xpEvents: [], levelUpEvent: null, badgeEvents: [], streakEvent: null,
  badgeQueue: [], lastStreakUpdate: null,

  syncFromServer: ({ xp, level, currentStreak, streakShields }) =>
    set({ xp, level, currentStreak, streakShields, pendingXP: 0 }),
  addOptimisticXP: (gain) => set((s) => ({ pendingXP: s.pendingXP + gain.total })),
  clearPendingXP: () => set({ pendingXP: 0 }),

  addXPEvent: (amount, position) =>
    set((s) => ({ xpEvents: [...s.xpEvents, { id: `xp-${Date.now()}-${Math.random()}`, amount, position }] })),
  clearXPEvent: (id) =>
    set((s) => ({ xpEvents: s.xpEvents.filter((e) => e.id !== id) })),
  setLevelUpEvent: (event) => set({ levelUpEvent: event }),
  addBadgeEvent: (badge) => set((s) => ({ badgeEvents: [...s.badgeEvents, badge] })),
  clearBadgeEvent: (badgeId) =>
    set((s) => ({ badgeEvents: s.badgeEvents.filter((b) => b.badgeId !== badgeId) })),
  setStreakEvent: (event) => set({ streakEvent: event }),

  enqueueBadge: (badge) => set((s) => ({ badgeQueue: [...s.badgeQueue, badge] })),
  dequeueBadge: () => set((s) => ({ badgeQueue: s.badgeQueue.slice(1) })),
  applyStreakUpdate: (update) => set({ lastStreakUpdate: update, currentStreak: update.newStreak }),
}));
