"use client";

import { useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useGamificationStore } from "@/store/gamification";
import { getLevelTitle, getXPForNextLevel } from "@/lib/gamification/xp";
import { XPPopup } from "./XPPopup";
import { LevelUpOverlay } from "./LevelUpOverlay";
import { BadgeUnlock } from "./BadgeUnlock";
import { StreakCelebration } from "./StreakCelebration";

/**
 * Mounted once in AppShell. Reads from the gamification store and renders
 * all active animation overlays — XP popups, level-up screen, badge toasts,
 * and streak confetti.
 */
export function GamificationRenderer() {
  const {
    xpEvents, clearXPEvent,
    levelUpEvent, setLevelUpEvent,
    badgeEvents, clearBadgeEvent,
    streakEvent, setStreakEvent,
    xp,
  } = useGamificationStore();

  const handleLevelDismiss = useCallback(() => setLevelUpEvent(null), [setLevelUpEvent]);
  const handleStreakDismiss = useCallback(() => setStreakEvent(null), [setStreakEvent]);

  const xpProgress = levelUpEvent
    ? getXPForNextLevel(xp)
    : { current: 0, next: 1, percent: 0 };

  return (
    <>
      {/* Floating XP popups */}
      <AnimatePresence>
        {xpEvents.map((evt) => (
          <XPPopup
            key={evt.id}
            id={evt.id}
            amount={evt.amount}
            position={evt.position}
            onDone={clearXPEvent}
          />
        ))}
      </AnimatePresence>

      {/* Level-up overlay */}
      <AnimatePresence>
        {levelUpEvent && (
          <LevelUpOverlay
            key="level-up"
            level={levelUpEvent.level}
            title={levelUpEvent.title ?? getLevelTitle(levelUpEvent.level)}
            xpProgress={{ current: xpProgress.current, next: xpProgress.next }}
            onDismiss={handleLevelDismiss}
          />
        )}
      </AnimatePresence>

      {/* Badge unlock toasts (stacked, bottom-right) */}
      <AnimatePresence>
        {badgeEvents.map((badge, i) => (
          <BadgeUnlock
            key={badge.badgeId}
            badge={badge}
            index={i}
            onDismiss={clearBadgeEvent}
          />
        ))}
      </AnimatePresence>

      {/* Streak milestone confetti */}
      <AnimatePresence>
        {streakEvent && (
          <StreakCelebration
            key="streak"
            days={streakEvent.days}
            onDismiss={handleStreakDismiss}
          />
        )}
      </AnimatePresence>
    </>
  );
}
