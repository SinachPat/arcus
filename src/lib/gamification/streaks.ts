import { STREAK } from "@/lib/constants";
import type { StreakUpdate } from "@/types";

/** Convert a UTC ISO timestamp to a YYYY-MM-DD date string in a given IANA timezone. */
function toLocalDate(isoString: string, timezone: string): string {
  return new Date(isoString).toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Today's YYYY-MM-DD in the given timezone. */
function todayLocal(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

interface StreakState {
  currentStreak:  number;
  longestStreak:  number;
  streakShields:  number;
  lastStudyDate:  string | null; // YYYY-MM-DD
}

interface SessionResult {
  questionsAnswered: number;
  studyMinutes:      number;
  timezone:          string; // IANA, e.g. "America/New_York"
}

/**
 * Calculate the new streak state after a completed session.
 * Must be called server-side only (after writing the session to DB).
 */
export function calculateStreakUpdate(state: StreakState, session: SessionResult): StreakUpdate {
  const { questionsAnswered, studyMinutes, timezone } = session;

  // Session doesn't qualify if below minimums
  if (questionsAnswered < STREAK.MIN_SESSION_QUESTIONS || studyMinutes < STREAK.MIN_SESSION_MINUTES) {
    return {
      newStreak:       state.currentStreak,
      streakBroken:    false,
      shieldDeployed:  false,
      shieldsRemaining: state.streakShields,
      milestoneReached: null,
    };
  }

  const today     = todayLocal(timezone);
  const yesterday = new Date(new Date().setDate(new Date().getDate() - 1))
    .toLocaleDateString("en-CA", { timeZone: timezone });

  const lastDate = state.lastStudyDate;

  // Already studied today — no change
  if (lastDate === today) {
    return {
      newStreak:        state.currentStreak,
      streakBroken:     false,
      shieldDeployed:   false,
      shieldsRemaining: state.streakShields,
      milestoneReached: null,
    };
  }

  let newStreak      = state.currentStreak;
  let streakBroken   = false;
  let shieldDeployed = false;
  let shields        = state.streakShields;

  if (lastDate === yesterday) {
    // Consecutive day — extend streak
    newStreak = state.currentStreak + 1;
  } else if (lastDate !== null) {
    // Missed at least one day
    if (shields > 0) {
      // Auto-deploy a shield
      shields--;
      shieldDeployed = true;
      newStreak      = state.currentStreak + 1;
    } else {
      streakBroken = true;
      newStreak    = 1; // reset to 1 for today's session
    }
  } else {
    // First ever session
    newStreak = 1;
  }

  // Check if a shield should be earned (every SHIELD_EARN_INTERVAL_DAYS)
  const shieldEarned =
    newStreak > 0 &&
    newStreak % STREAK.SHIELD_EARN_INTERVAL_DAYS === 0 &&
    shields < STREAK.MAX_SHIELDS;

  if (shieldEarned) shields++;

  const longestStreak = Math.max(state.longestStreak, newStreak);

  const milestoneReached =
    STREAK.MILESTONES.find(
      (m) => newStreak === m && state.currentStreak < m
    ) ?? null;

  return {
    newStreak,
    streakBroken,
    shieldDeployed,
    shieldsRemaining: shields,
    milestoneReached: milestoneReached ?? null,
  };
}

export type { StreakState };

// ─── Spec-aligned export (Layer 1 §9) ─────────────────────────────────────────

/**
 * Determine what streak action to take given the user's last study date
 * and the current moment in their local timezone.
 *
 * Both dates should be in the user's local timezone (caller responsible
 * for the `Intl` conversion before passing them in).
 *
 * Returns:
 *   'new'            – first ever session (no lastStudyDate)
 *   'already_studied'– lastStudyDate is the same calendar day as nowInUserTz
 *   'increment'      – lastStudyDate was yesterday → extend streak
 *   'broken'         – lastStudyDate is older than yesterday → streak resets
 */
export function determineStreakAction(
  lastStudyDate: Date | null,
  nowInUserTz: Date,
): "increment" | "already_studied" | "broken" | "new" {
  if (!lastStudyDate) return "new";

  // Normalise to YYYY-MM-DD strings for calendar-day comparison
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const todayStr = fmt(nowInUserTz);
  const lastStr  = fmt(lastStudyDate);

  if (lastStr === todayStr) return "already_studied";

  const yesterday = new Date(nowInUserTz);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = fmt(yesterday);

  if (lastStr === yesterdayStr) return "increment";

  return "broken";
}
