import { XP, XP_VALUES, xpForLevel, MAX_LEVEL, MAX_LEVEL_XP, LEVEL_THRESHOLDS } from "@/lib/constants";
import type { XPGain } from "@/types";

interface ComputeXPParams {
  difficulty:          number;  // 1–5
  isFirstAttempt:      boolean;
  consecutiveCorrect:  number;  // count BEFORE this question
  isRepeat:            boolean; // seen this question before
}

/** Compute XP award for a single correct answer. Returns 0 for wrong answers. */
export function computeAnswerXP(params: ComputeXPParams): XPGain {
  const { difficulty, isFirstAttempt, consecutiveCorrect, isRepeat } = params;

  const base         = XP.CORRECT_ANSWER_BASE;
  const diffMult     = XP.DIFFICULTY_MULTIPLIER[difficulty] ?? 1;
  const repeatFactor = isRepeat ? XP.REPEATED_QUESTION_FACTOR : 1;

  const difficultyBonus   = Math.round(base * (diffMult - 1) * repeatFactor);
  const firstAttemptBonus = isFirstAttempt ? Math.round(base * (XP.FIRST_ATTEMPT_MULTIPLIER - 1) * repeatFactor) : 0;
  // Streak bonus kicks in after 3rd consecutive correct
  const streakBonus       = consecutiveCorrect >= 2 ? XP.CONSECUTIVE_CORRECT_BONUS : 0;

  const total = Math.round((base + difficultyBonus + firstAttemptBonus + streakBonus) * repeatFactor);

  return {
    base,
    difficultyBonus,
    firstAttemptBonus,
    streakBonus,
    total,
    reason: "correct_answer",
  };
}

/** Compute XP for completing a mock exam. Scale: base * (score/100) * 5 → max 500. */
export function computeMockExamXP(scorePercent: number): number {
  return Math.round(XP.MOCK_EXAM_BASE * (scorePercent / 100) * 5);
}

/** Derive the current level from total cumulative XP. */
export function levelFromXP(totalXP: number): number {
  if (totalXP >= MAX_LEVEL_XP) return MAX_LEVEL;

  let level = 1;
  for (let l = MAX_LEVEL; l >= 2; l--) {
    if (totalXP >= xpForLevel(l)) {
      level = l;
      break;
    }
  }
  return level;
}

// ─── Spec-aligned exports (Layer 1 §9) ────────────────────────────────────────

/**
 * Generic XP calculator matching the spec's `calculateXP` signature.
 * Delegates to the detailed `computeAnswerXP` / fixed values above.
 */
export function calculateXP(params: {
  type: "correct_answer" | "session_complete" | "daily_goal" | "mock_exam" | "tutor_resolved";
  difficulty?: number;
  isFirstAttempt?: boolean;
  consecutiveCorrect?: number;
  mockScore?: number;
}): number {
  const { type, difficulty = 3, isFirstAttempt = true, consecutiveCorrect = 0, mockScore = 0 } = params;

  switch (type) {
    case "correct_answer": {
      const xpGain = computeAnswerXP({ difficulty, isFirstAttempt, consecutiveCorrect, isRepeat: false });
      return xpGain.total;
    }
    case "session_complete":
      return XP_VALUES.sessionComplete;
    case "daily_goal":
      return XP_VALUES.dailyGoal;
    case "mock_exam":
      return Math.min(
        Math.round(XP_VALUES.mockExam.base + mockScore * XP_VALUES.mockExam.perScorePoint),
        XP_VALUES.mockExam.max,
      );
    case "tutor_resolved":
      return XP_VALUES.tutorResolved.amount;
  }
}

/** Derive level 1–50 from cumulative XP. */
export function calculateLevel(xp: number): number {
  return levelFromXP(xp);
}

/** Human-readable tier title for a given level. */
export function getLevelTitle(level: number): string {
  for (const tier of LEVEL_THRESHOLDS) {
    const [min, max] = tier.range;
    if (level >= min && level <= max) return tier.title;
  }
  return "Master";
}

/** XP needed to reach the next level from current total. */
export function xpToNextLevel(totalXP: number): { current: number; needed: number; level: number } {
  const level = levelFromXP(totalXP);
  if (level >= MAX_LEVEL) return { current: totalXP, needed: 0, level: MAX_LEVEL };

  const nextLevelXP = xpForLevel(level + 1);
  const thisLevelXP = xpForLevel(level);
  return {
    current: totalXP - thisLevelXP,
    needed:  nextLevelXP - thisLevelXP,
    level,
  };
}
