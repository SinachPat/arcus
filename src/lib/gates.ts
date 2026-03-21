import { AI_MESSAGE_LIMITS, DAILY_QUESTION_LIMITS, MONTHLY_MOCK_LIMITS } from "@/lib/constants";
import type { SubscriptionTier } from "@/types/database";

// ---- Feature availability per tier ----

const FEATURE_GATES = {
  aiTutor:          { free: true,  pro: true,  premium: true  },
  mockExam:         { free: true,  pro: true,  premium: true  },
  studyPlan:        { free: false, pro: true,  premium: true  },
  skillTree:        { free: false, pro: true,  premium: true  },
  leaderboard:      { free: true,  pro: true,  premium: true  },
  flashcards:       { free: false, pro: true,  premium: true  },
  streakShields:    { free: false, pro: true,  premium: true  },
  analyticsAdvanced:{ free: false, pro: false, premium: true  },
  offlineMode:      { free: false, pro: false, premium: true  },
  prioritySupport:  { free: false, pro: true,  premium: true  },
} as const;

type Feature = keyof typeof FEATURE_GATES;

/** Whether the given tier has access to a feature. */
export function canAccess(tier: SubscriptionTier, feature: Feature): boolean {
  return FEATURE_GATES[feature][tier];
}

/** Whether the user has AI messages remaining today. */
export function hasAiMessagesRemaining(
  tier:         SubscriptionTier,
  messagesUsed: number,
): boolean {
  return messagesUsed < AI_MESSAGE_LIMITS[tier];
}

/** Whether the user can answer more questions today (null = unlimited). */
export function canAnswerQuestion(
  tier:             SubscriptionTier,
  questionsToday:   number,
): boolean {
  const limit = DAILY_QUESTION_LIMITS[tier];
  if (limit === null) return true;
  return questionsToday < limit;
}

/** Whether the user can start another mock exam this month (null = unlimited). */
export function canStartMockExam(
  tier:           SubscriptionTier,
  mocksThisMonth: number,
): boolean {
  const limit = MONTHLY_MOCK_LIMITS[tier];
  if (limit === null) return true;
  return mocksThisMonth < limit;
}

/** Return a human-readable upgrade reason for a blocked feature. */
export function upgradePrompt(feature: Feature, tier: SubscriptionTier): string {
  if (tier === "free") {
    const proFeatures: Feature[] = ["studyPlan", "skillTree", "flashcards", "streakShields", "prioritySupport"];
    if (proFeatures.includes(feature)) return "Upgrade to Pro to unlock this feature.";
    return "This feature requires a Pro or Premium subscription.";
  }
  return "Upgrade to Premium to unlock this feature.";
}
