// App-level types — not directly tied to DB rows

export type { Database, SubscriptionTier, TutorMode, SessionType, QuestionType, BadgeRarity } from "./database";

// ---- Question UI state ----

export interface QuestionState {
  questionId: string;
  selectedOptionIds: string[];
  isSubmitted: boolean;
  isCorrect: boolean | null;
  hintUsed: boolean;
  timeStarted: number; // Date.now()
}

// ---- Session state ----

export interface ActiveSession {
  sessionId: string;
  examId: string;
  type: import("./database").SessionType;
  questions: SessionQuestion[];
  currentIndex: number;
  startedAt: number;
  isMockExam: boolean;
  timeLimitMs: number | null; // null = no timer
}

export interface SessionQuestion {
  id: string;
  domainId: string;
  subtopicId: string | null;
  type: import("./database").QuestionType;
  content: string;
  options: Array<{ id: string; text: string }>;
  difficulty: number;
  flagged: boolean;
  state: QuestionState | null;
}

// ---- Gamification ----

export interface XPGain {
  base: number;
  difficultyBonus: number;
  streakBonus: number;
  firstAttemptBonus: number;
  total: number;
  reason: string;
}

export interface StreakUpdate {
  newStreak: number;
  streakBroken: boolean;
  shieldDeployed: boolean;
  shieldsRemaining: number;
  milestoneReached: number | null; // 7, 30, 60, 100
}

export interface BadgeEarned {
  badgeId: string;
  code: string;
  name: string;
  rarity: import("./database").BadgeRarity;
  xpReward: number;
  iconName: string;
}

// ---- Study plan ----

export interface GeneratedStudyPlan {
  targetExamDate: string | null;
  estimatedReadyDate: string;
  totalWeeks: number;
  weeks: Array<{
    week: number;
    focusDomains: string[];
    dailyMinutes: number;
    goals: string[];
  }>;
}

// ---- Readiness ----

export interface ReadinessScore {
  overall: number; // 0–100
  byDomain: Record<string, number>; // domainId → 0–100
  trend: "improving" | "declining" | "stable";
  predictedPassDate: { start: string; end: string; confidence: "low" | "medium" | "high" } | null;
}

// ---- Leaderboard ----

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  level: number;
  xpEarned: number;
  rank: number;
  isCurrentUser: boolean;
}

// ---- AI Tutor ----

export interface TutorContext {
  questionId?: string;
  questionContent?: string;
  userAnswer?: string[];
  correctAnswer?: string[];
  explanation?: string;
  domainName?: string;
  masteryPercent?: number;
}

// ---- Spec-aligned camelCase interfaces (app layer, not raw DB) ----

/** Answer option as used in the app layer (camelCase). DB stores snake_case. */
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

/** One week in a generated study plan (app layer). */
export interface StudyPlanWeek {
  weekNumber: number;
  focusDomains: string[];
  dailyMinutes: number;
  goals: string[];
}

/** A single XP event fired client-side for optimistic animation. */
export interface XPEvent {
  amount: number;
  reason: string;
  timestamp: Date;
}

// ---- Subscription ----

export interface SubscriptionDetails {
  tier: import("./database").SubscriptionTier;
  expiresAt: string | null;
  stripeCustomerId: string | null;
  dailyAiMessagesUsed: number;
  dailyAiMessagesLimit: number;
  dailyQuestionsLimit: number | null; // null = unlimited
}
