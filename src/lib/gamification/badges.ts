import type { DbBadge, BadgeCriteria } from "@/types/database";
import type { BadgeEarned } from "@/types";

interface EvaluationContext {
  // Gamification state
  currentStreak:       number;
  longestStreak:       number;
  consecutiveCorrect:  number;
  totalQuestionsAnswered: number;
  onboardingCompleted: boolean;

  // Domain mastery: domainId → mastery%
  domainMastery: Record<string, number>;

  // Latest mock exam (if applicable)
  mockResult?: {
    scorePercent:     number;
    passed:           boolean;
    timeUsedPercent:  number; // 0–100: how much of allotted time was used
    mode:             "full" | "half" | "quick";
  };
}

/** Evaluate a single badge's criteria against the current user context. */
function meetscriterion(criteria: BadgeCriteria, ctx: EvaluationContext): boolean {
  switch (criteria.type) {
    case "onboarding_complete":
      return ctx.onboardingCompleted;

    case "consecutive_correct":
      return (criteria.threshold !== undefined) && ctx.consecutiveCorrect >= criteria.threshold;

    case "streak_days":
      return (criteria.threshold !== undefined) && ctx.currentStreak >= criteria.threshold;

    case "domain_mastery":
      return Object.values(ctx.domainMastery).some(
        (m) => criteria.threshold !== undefined && m >= criteria.threshold
      );

    case "mock_exam_score":
      if (!ctx.mockResult) return false;
      return (
        (criteria.min_score === undefined || ctx.mockResult.scorePercent >= criteria.min_score) &&
        (criteria.mode === undefined || ctx.mockResult.mode === criteria.mode)
      );

    case "mock_exam_speed":
      if (!ctx.mockResult) return false;
      return (
        ctx.mockResult.passed &&
        (criteria.time_percent_max === undefined || ctx.mockResult.timeUsedPercent <= criteria.time_percent_max)
      );

    case "questions_answered":
      return (criteria.threshold !== undefined) && ctx.totalQuestionsAnswered >= criteria.threshold;

    default:
      return false;
  }
}

/**
 * Given the full badge list and set of already-earned badge IDs,
 * return any newly earned badges for this event.
 */
export function evaluateBadges(
  allBadges:    DbBadge[],
  earnedIds:    Set<string>,
  ctx:          EvaluationContext,
): BadgeEarned[] {
  const newlyEarned: BadgeEarned[] = [];

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;
    if (meetscriterion(badge.criteria as BadgeCriteria, ctx)) {
      newlyEarned.push({
        badgeId:  badge.id,
        code:     badge.code,
        name:     badge.name,
        rarity:   badge.rarity,
        xpReward: badge.xp_reward,
        iconName: badge.icon_name,
      });
    }
  }

  return newlyEarned;
}

export type { EvaluationContext };

// ─── Spec-aligned export (Layer 1 §9) ─────────────────────────────────────────

/**
 * Evaluate raw badge criteria JSON against a flat user state snapshot.
 * Used by the tRPC study router after every answer to check for new badges.
 */
export function evaluateBadgeCriteria(
  criteria: Record<string, unknown>,
  userState: {
    onboardingCompleted: boolean;
    currentStreak: number;
    consecutiveCorrect: number;
    totalQuestionsAnswered: number;
    domainMasteryPercent: number; // highest single-domain mastery
    mockScore?: number;           // latest mock exam score 0–100
    mockSpeedPercent?: number;    // % of allotted time used (lower = faster)
  },
): boolean {
  const { type, threshold, min_score, time_percent_max } = criteria as {
    type?: string;
    threshold?: number;
    min_score?: number;
    time_percent_max?: number;
  };

  switch (type) {
    case "onboarding_complete":
      return userState.onboardingCompleted;

    case "consecutive_correct":
      return threshold !== undefined && userState.consecutiveCorrect >= threshold;

    case "streak_days":
      return threshold !== undefined && userState.currentStreak >= threshold;

    case "domain_mastery":
      return threshold !== undefined && userState.domainMasteryPercent >= threshold;

    case "mock_exam_score":
      return (
        userState.mockScore !== undefined &&
        min_score !== undefined &&
        userState.mockScore >= min_score
      );

    case "mock_exam_speed":
      return (
        userState.mockScore !== undefined &&
        userState.mockSpeedPercent !== undefined &&
        time_percent_max !== undefined &&
        userState.mockScore >= 72 && // must pass
        userState.mockSpeedPercent <= time_percent_max
      );

    case "questions_answered":
      return threshold !== undefined && userState.totalQuestionsAnswered >= threshold;

    default:
      return false;
  }
}
