import type { SubscriptionTier } from "@/types/database";

// ---- Exam IDs (match seed) ----

export const SAA_C03_EXAM_ID = "a1b2c3d4-0000-4000-8000-000000000001";

export const SAA_C03_DOMAIN_IDS = {
  RESILIENT:   "b1000000-0000-4000-8000-000000000001",
  PERFORMANCE: "b1000000-0000-4000-8000-000000000002",
  SECURITY:    "b1000000-0000-4000-8000-000000000003",
  COST:        "b1000000-0000-4000-8000-000000000004",
  OPERATIONS:  "b1000000-0000-4000-8000-000000000005",
  IMPROVEMENT: "b1000000-0000-4000-8000-000000000006",
} as const;

export const SAA_C03_DOMAIN_WEIGHTS: Record<string, number> = {
  [SAA_C03_DOMAIN_IDS.RESILIENT]:   30,
  [SAA_C03_DOMAIN_IDS.PERFORMANCE]: 26,
  [SAA_C03_DOMAIN_IDS.SECURITY]:    24,
  [SAA_C03_DOMAIN_IDS.COST]:        10,
  [SAA_C03_DOMAIN_IDS.OPERATIONS]:   6,
  [SAA_C03_DOMAIN_IDS.IMPROVEMENT]:  4,
};

// ---- XP values (from PRD §6.1) ----

export const XP = {
  CORRECT_ANSWER_BASE:      10,
  DIFFICULTY_MULTIPLIER:    { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3 } as Record<number, number>,
  CONSECUTIVE_CORRECT_BONUS: 5,   // per question after 3rd in a row
  DAILY_GOAL_COMPLETE:       50,
  SESSION_COMPLETE:          25,
  MOCK_EXAM_BASE:           100,  // scaled by score: base * (score/100) * 5 → max 500
  FIRST_ATTEMPT_MULTIPLIER:  1.5,
  AI_TUTOR_RESOLVED:         15,
  AI_TUTOR_DAILY_CAP:       100,
  REPEATED_QUESTION_FACTOR:  0.5, // 50% XP for questions seen before
  STREAK_RECOVERY_COST:     500,
} as const;

// ---- Level thresholds (cumulative XP) ----
// Levels 1–50. Tier titles and unlock gates.

export const LEVEL_TIERS = [
  { minLevel: 1,  maxLevel: 10, title: "Novice",       minXP: 0 },
  { minLevel: 11, maxLevel: 20, title: "Apprentice",   minXP: 1000 },
  { minLevel: 21, maxLevel: 30, title: "Practitioner", minXP: 5000 },
  { minLevel: 31, maxLevel: 40, title: "Expert",       minXP: 15000 },
  { minLevel: 41, maxLevel: 50, title: "Master",       minXP: 35000 },
] as const;

export const MAX_LEVEL = 50;
export const MAX_LEVEL_XP = 60000;

/** Cumulative XP required to reach a given level (1-indexed). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Quadratic curve: XP(n) ≈ 100 * (n-1)^1.6
  return Math.floor(100 * Math.pow(level - 1, 1.6));
}

// ---- Streaks ----

export const STREAK = {
  SHIELD_EARN_INTERVAL_DAYS: 7,
  MAX_SHIELDS:               3,
  MIN_SESSION_MINUTES:       1,
  MIN_SESSION_QUESTIONS:     3,
  RECOVERY_WINDOW_HOURS:     24, // Pro: manual recovery within 24h of break
  MILESTONES:               [7, 30, 60, 100] as const,
} as const;

// ---- AI message limits by tier ----

export const AI_MESSAGE_LIMITS: Record<SubscriptionTier, number> = {
  free:    3,
  pro:     50,
  premium: 150,
};

// ---- Daily question limits by tier ----

export const DAILY_QUESTION_LIMITS: Record<SubscriptionTier, number | null> = {
  free:    20,
  pro:     null, // unlimited
  premium: null,
};

// ---- Mock exam limits by tier ----

export const MONTHLY_MOCK_LIMITS: Record<SubscriptionTier, number | null> = {
  free:    1, // first free, then 1/month
  pro:     null,
  premium: null,
};

// ---- AI models (from PRD §9.1) ----

export const AI_MODELS = {
  // camelCase keys — spec-aligned
  tutorSocratic:  "claude-sonnet-4-20250514",
  tutorDirect:    "claude-haiku-4-5-20251001",
  studyPlan:      "claude-sonnet-4-20250514",
  questionGen:    "gpt-4o",
  questionSelect: "gpt-4o-mini",
  examAnalysis:   "claude-sonnet-4-20250514",
} as const;

// ---- AI cost circuit breakers ----

export const AI_COST = {
  CIRCUIT_BREAKER_DAILY_USD:  5,      // alert + rate-limit at $5/user/day
  PRO_MONTHLY_BUDGET_USD:     8,
  PREMIUM_MONTHLY_BUDGET_USD: 15,
  RATE_LIMIT_INTERVAL_MS:     10 * 60 * 1000, // 1 msg / 10 min when breaker fires
  COST_REVENUE_ALERT_RATIO:   0.40,   // alert if AI cost > 40% of revenue
} as const;

// ---- Question & difficulty ----

export const DIFFICULTY = {
  MIN: 1,
  MAX: 5,
  DEFAULT: 3,
  STEP_UP_AFTER_CONSECUTIVE_CORRECT: 2,
  STEP_DOWN_AFTER_CONSECUTIVE_WRONG:  2,
} as const;

export const QUESTION_REPORT_SUSPENSION_THRESHOLD = 3;
export const SHADOW_MODE_VALIDATION_DAYS = 14;
export const MIN_LIVE_QUESTION_BANK_SIZE = 500;

// ---- Mock exam modes ----

export const MOCK_EXAM_MODES = {
  full:  { questionCount: 65, timeLimitMinutes: 130 },
  half:  { questionCount: 32, timeLimitMinutes: 65 },
  quick: { questionCount: 15, timeLimitMinutes: 30 },
} as const;

export const MOCK_PASSING_SCORE_PERCENT = 72;
export const MOCK_TIME_WARNING_MINUTES   = 15;
export const MOCK_TIME_CRITICAL_MINUTES  = 5;

// ---- Badge codes ----

export const BADGE_CODES = {
  FIRST_STEPS:   "first_steps",
  QUICK_LEARNER: "quick_learner",
  WEEK_WARRIOR:  "week_warrior",
  DOMAIN_MASTER: "domain_master",
  IRON_WILL:     "iron_will",
  PERFECT_SCORE: "perfect_score",
  SPEED_DEMON:   "speed_demon",
  CENTURION:     "centurion",
  THE_ARCHITECT: "the_architect",
} as const;

// ---- Leaderboard ----

export const LEADERBOARD = {
  WEEK_RESET_DAY:        1,   // Monday (0=Sun, 1=Mon)
  WEEK_RESET_HOUR_UTC:   0,
  REFRESH_INTERVAL_MS:   5 * 60 * 1000, // 5 minutes
  TOP_BADGE_COUNT:       3,
  PAGE_SIZE:             50,
} as const;

// ---- Subscription ----

export const STRIPE_PRICE_IDS = {
  PRO_MONTHLY:     process.env.STRIPE_PRO_MONTHLY_PRICE_ID     ?? "",
  PRO_ANNUAL:      process.env.STRIPE_PRO_ANNUAL_PRICE_ID      ?? "",
  PREMIUM_MONTHLY: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? "",
  PREMIUM_ANNUAL:  process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID  ?? "",
} as const;

export const SUBSCRIPTION_PRICES = {
  pro:     { monthly: 29, annual: 279 }, // $279 = ~20% off $348
  premium: { monthly: 49, annual: 470 },
} as const;

export const ANNUAL_DISCOUNT_PERCENT = 20;
export const FREE_TRIAL_DAYS         = 7;
export const PAYMENT_GRACE_PERIOD_DAYS = 3;

// ---- Onboarding ----

export const DIAGNOSTIC_QUESTION_COUNT      = 20;
export const DIAGNOSTIC_MIN_PER_DOMAIN      = 2;
export const RECALIBRATION_QUESTION_COUNT   = 10;
export const RECALIBRATION_COOLDOWN_DAYS    = 14;
export const RECALIBRATION_SCORE_DIVERGENCE = 15; // trigger if mock diverges >15pts

// ---- Adaptive algorithm ----

export const MASTERY_THRESHOLD_PERCENT    = 90; // "mastered" node in skill tree
export const SPACED_REPETITION_INTERVALS  = [1, 3, 7, 14, 30] as const; // days

// ---- App ----

export const APP_NAME = "Arcus";
export const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Spec-aligned exports (Layer 1 §6) ────────────────────────────────────────

/** Design token colours mirrored from globals.css — use CSS vars in components. */
export const DESIGN = {
  colors: {
    background:     "#0A0A0F",
    surface:        "#13131A",
    surfaceElevated:"#1C1C26",
    border:         "#2A2A38",
    borderActive:   "#3D3D52",
    accent:         "#00C97C",
    accentCyan:     "#22D3EE",
    success:        "#4ADE80",
    warning:        "#F59E0B",
    danger:         "#EF4444",
    textPrimary:    "#F1F1F5",
    textSecondary:  "#8B8BA7",
    textMuted:      "#52526B",
  },
} as const;

/** XP values — spec shape. The `XP` constant above has the same values. */
export const XP_VALUES = {
  correctAnswer:            { base: 10 },
  difficultyMultiplier:     { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3 } as Record<number, number>,
  firstAttemptBonus:        1.5,
  consecutiveCorrectBonus:  5,   // per question after 3rd in a row, max 50 total
  sessionComplete:          25,
  dailyGoal:                50,
  mockExam:                 { base: 100, perScorePoint: 4, max: 500 },
  tutorResolved:            { amount: 15, dailyCap: 100 },
} as const;

/** Level thresholds — spec shape (mirrors LEVEL_TIERS above). */
export const LEVEL_THRESHOLDS = [
  { min: 0,     max: 1000,  range: [1,  10] as [number, number], title: "Novice" },
  { min: 1000,  max: 5000,  range: [11, 20] as [number, number], title: "Apprentice" },
  { min: 5000,  max: 15000, range: [21, 30] as [number, number], title: "Practitioner" },
  { min: 15000, max: 35000, range: [31, 40] as [number, number], title: "Expert" },
  { min: 35000, max: 60000, range: [41, 50] as [number, number], title: "Master" },
] as const;

/** Daily limits — spec shape. */
export const DAILY_LIMITS = {
  questions:         { free: 20,  pro: Infinity, premium: Infinity },
  aiMessages:        { free: 3,   pro: 50,       premium: 150 },
  mockExamsPerMonth: { free: 1,   pro: Infinity, premium: Infinity },
} as const;

/** Domain weight by human-readable name (for study plan weighting). */
export const DOMAIN_WEIGHTS: Record<string, number> = {
  "Design Resilient Architectures":                0.30,
  "Design High-Performing Architectures":          0.26,
  "Design Secure Applications":                    0.24,
  "Design Cost-Optimized Architectures":           0.10,
  "Operationally Excellent Architectures":         0.06,
  "Continuous Improvement for Existing Solutions": 0.04,
};

/** Type-safe route map for `next/navigation` / `Link`. */
export const ROUTES = {
  home:         "/",
  login:        "/login",
  signup:       "/signup",
  resetPassword:"/reset-password",
  onboarding:   "/onboarding",
  dashboard:    "/dashboard",
  study:        "/study",
  studyDomain:  (id: string) => `/study/${id}`,
  recalibrate:  "/study/recalibrate",
  practice:     "/practice",
  quiz:         "/practice/quiz",
  mock:         "/practice/mock",
  mockResults:  "/practice/mock/results",
  tutor:        "/tutor",
  leaderboard:  "/leaderboard",
  progress:     "/progress",
  profile:      "/profile",
  settings:     "/settings",
} as const;
