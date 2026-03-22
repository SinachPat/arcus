"use client";

import { useCallback } from "react";
import { useGamificationStore } from "@/store/gamification";
import { getLevelTitle, getXPForNextLevel } from "@/lib/gamification/xp";
import type { BadgeEarned } from "@/types";

/**
 * Central hook for firing gamification animations.
 * Call once in AppShell; expose triggers to child components via context or props.
 */
export function useGamification() {
  const store = useGamificationStore();

  /** Fire a floating +N XP popup near a given screen position. */
  const triggerXP = useCallback(
    (amount: number, position?: { x: number; y: number }) => {
      if (amount <= 0) return;
      store.addXPEvent(amount, position);
    },
    [store]
  );

  /**
   * Fire the level-up overlay.
   * Pass the new level; computes title and XP range automatically.
   */
  const triggerLevelUp = useCallback(
    (newLevel: number, totalXP: number) => {
      const title = getLevelTitle(newLevel);
      const xpProgress = getXPForNextLevel(totalXP);
      store.setLevelUpEvent({ level: newLevel, title });
      // Store xpProgress in a separate field isn't needed — LevelUpOverlay reads from store
      void xpProgress; // used by overlay when it reads totalXP from store
    },
    [store]
  );

  /** Queue a badge unlock toast. */
  const triggerBadge = useCallback(
    (badge: BadgeEarned) => {
      store.addBadgeEvent(badge);
    },
    [store]
  );

  /** Fire the streak milestone confetti (only at 7, 30, 60, 100). */
  const triggerStreak = useCallback(
    (days: number) => {
      const MILESTONES = [7, 30, 60, 100];
      if (MILESTONES.includes(days)) {
        store.setStreakEvent({ days });
      }
    },
    [store]
  );

  return { triggerXP, triggerLevelUp, triggerBadge, triggerStreak };
}
