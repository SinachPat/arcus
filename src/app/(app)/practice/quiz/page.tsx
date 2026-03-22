"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Check, X, Lightbulb, Flag, ChevronRight, Flame, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { SAA_C03_EXAM_ID, SAA_C03_DOMAIN_IDS } from "@/lib/constants";
import { getLevelTitle } from "@/lib/gamification/xp";
import { useSessionStore } from "@/store/session";
import Link from "next/link";

const DOMAIN_LABELS: Record<string, string> = {
  [SAA_C03_DOMAIN_IDS.RESILIENT]: "Resilient",
  [SAA_C03_DOMAIN_IDS.PERFORMANCE]: "High-Performing",
  [SAA_C03_DOMAIN_IDS.SECURITY]: "Security",
  [SAA_C03_DOMAIN_IDS.COST]: "Cost-Optimized",
  [SAA_C03_DOMAIN_IDS.OPERATIONS]: "Operations",
  [SAA_C03_DOMAIN_IDS.IMPROVEMENT]: "Improvement",
};

interface QuestionData {
  id: string;
  domainId: string;
  type: string;
  content: string;
  difficulty: number;
  explanation: string;
  awsDocUrl: string;
  options: Array<{ id: string; text: string }>;
}

interface AnswerResult {
  isCorrect: boolean;
  correctOptionIds: string[];
  explanation: string;
  awsDocUrl: string;
  xpEarned: number;
  newLevel: number | null;
  badgesEarned: Array<{ code: string; name: string; xpReward: number }>;
  updatedMastery: number;
}

interface SessionStats {
  totalQuestions: number;
  correctAnswers: number;
  totalXP: number;
  newLevel: number | null;
  badges: Array<{ code: string; name: string; xpReward: number }>;
  streakDay: number;
}

function QuizContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setTutorContext = useSessionStore((s) => s.setTutorContext);

  const count = parseInt(searchParams.get("count") ?? "10");
  const domainId = searchParams.get("domainId") ?? undefined;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Session-level stats
  const statsRef = useRef<SessionStats>({
    totalQuestions: 0,
    correctAnswers: 0,
    totalXP: 0,
    newLevel: null,
    badges: [],
    streakDay: 0,
  });

  // Fetch questions
  const { data: fetchedQuestions, isLoading: loadingQuestions } = trpc.study.getNextQuestions.useQuery(
    { examId: SAA_C03_EXAM_ID, count, domainId },
    { enabled: true }
  );

  // Start session mutation
  const startSession = trpc.study.startSession.useMutation();
  const submitAnswer = trpc.study.submitAnswer.useMutation();
  const completeSession = trpc.study.completeSession.useMutation();

  // Initialize session + questions
  useEffect(() => {
    if (fetchedQuestions && fetchedQuestions.length > 0 && !sessionId) {
      setQuestions(fetchedQuestions as QuestionData[]);
      startSession.mutate(
        { examId: SAA_C03_EXAM_ID, type: "practice" },
        { onSuccess: (res) => setSessionId(res.sessionId) }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedQuestions]);

  const question = questions[currentIdx];
  const isMultiSelect = question?.type === "multi_select";
  const totalQuestions = questions.length;
  const progress = totalQuestions > 0 ? ((currentIdx + (feedback ? 1 : 0)) / totalQuestions) * 100 : 0;

  const toggleOption = useCallback(
    (optionId: string) => {
      if (feedback) return;
      if (isMultiSelect) {
        setSelectedIds((prev) =>
          prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
        );
      } else {
        setSelectedIds([optionId]);
      }
    },
    [feedback, isMultiSelect]
  );

  const handleConfirm = useCallback(async () => {
    if (!question || !sessionId || selectedIds.length === 0 || feedback) return;

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    try {
      const result = await submitAnswer.mutateAsync({
        questionId: question.id,
        sessionId,
        selectedOptionIds: selectedIds,
        hintUsed,
        timeSpentSeconds: timeSpent,
      });

      const answerResult = result as AnswerResult;
      setFeedback(answerResult);

      // Update session stats
      const stats = statsRef.current;
      stats.totalQuestions++;
      if (answerResult.isCorrect) stats.correctAnswers++;
      stats.totalXP += answerResult.xpEarned;
      if (answerResult.newLevel) stats.newLevel = answerResult.newLevel;
      stats.badges.push(...answerResult.badgesEarned);
    } catch (err) {
      console.error("Failed to submit answer:", err);
    }
  }, [question, sessionId, selectedIds, feedback, questionStartTime, hintUsed, submitAnswer]);

  const handleNext = useCallback(async () => {
    if (currentIdx >= totalQuestions - 1) {
      // Finish session
      if (sessionId) {
        try {
          const result = await completeSession.mutateAsync({ sessionId });
          statsRef.current.streakDay = result.streakUpdate.newStreak;
          statsRef.current.totalXP += result.sessionXP;
          if (result.newLevel) statsRef.current.newLevel = result.newLevel;
        } catch {
          // non-critical
        }
      }
      setShowSummary(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedIds([]);
      setFeedback(null);
      setHintUsed(false);
      setShowHint(false);
      setQuestionStartTime(Date.now());
    }
  }, [currentIdx, totalQuestions, sessionId, completeSession]);

  const toggleFlag = useCallback(() => {
    if (!question) return;
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(question.id)) next.delete(question.id);
      else next.add(question.id);
      return next;
    });
  }, [question]);

  const handleHint = useCallback(() => {
    setHintUsed(true);
    setShowHint(true);
  }, []);

  // Loading state
  if (loadingQuestions || questions.length === 0) {
    return (
      <div style={{ padding: "0", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ height: 4, background: "#2A2A38", marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 24, width: 200, background: "#13131A", borderRadius: 4 }} className="animate-pulse" />
          <div style={{ height: 80, background: "#13131A", borderRadius: 8 }} className="animate-pulse" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 52, background: "#13131A", borderRadius: 8, border: "1px solid #2A2A38" }} className="animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Session Summary Overlay
  if (showSummary) {
    const stats = statsRef.current;
    const accuracy = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10,10,15,0.95)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#F1F1F5", margin: 0 }}>
            Session Complete
          </h1>
          <p style={{ fontSize: 14, color: "#8B8BA7", marginTop: 8 }}>
            {stats.totalQuestions} questions · {accuracy}% accuracy
          </p>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, margin: "28px 0" }}>
            <SummaryStat
              value={stats.totalXP}
              label="XP Earned"
              color="#00C97C"
              icon={<Sparkles size={16} style={{ color: "#00C97C" }} />}
              animate
            />
            <SummaryStat
              value={stats.correctAnswers}
              label="Correct"
              color="#4ADE80"
              icon={<Check size={16} style={{ color: "#4ADE80" }} />}
            />
            <SummaryStat
              value={stats.streakDay}
              label="Streak Day"
              color="#F59E0B"
              icon={<Flame size={16} style={{ color: "#F59E0B" }} />}
            />
            <SummaryStat
              value={stats.newLevel ?? 0}
              label={stats.newLevel ? "LEVEL UP!" : "Level"}
              color={stats.newLevel ? "#00C97C" : "#F1F1F5"}
              icon={null}
              levelUp={!!stats.newLevel}
            />
          </div>

          {/* Badge unlocks */}
          {stats.badges.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 }}
              style={{ marginBottom: 24 }}
            >
              {stats.badges.map((badge) => (
                <div
                  key={badge.code}
                  style={{
                    background: "#13131A",
                    border: "1px solid rgba(0,201,124,0.25)",
                    borderRadius: 10,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 8,
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      background: "#4ADE8020",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={24} style={{ color: "#4ADE80" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#52526B", margin: 0 }}>Badge Earned</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#F1F1F5", margin: "2px 0 0 0" }}>
                      {badge.name}
                    </p>
                    <p style={{ fontSize: 12, color: "#8B8BA7", margin: "2px 0 0 0" }}>
                      +{badge.xpReward} XP
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Action buttons */}
          <Link href="/practice/quiz">
            <button style={summaryButtonPrimary}>
              Keep Studying →
            </button>
          </Link>
          <Link href="/dashboard">
            <button style={summaryButtonSecondary}>
              Back to Dashboard
            </button>
          </Link>
        </div>
      </motion.div>
    );
  }

  // ── Active Quiz ──

  const isFlagged = flaggedIds.has(question.id);
  const domainLabel = DOMAIN_LABELS[question.domainId] ?? "General";
  const difficultyStars = "★".repeat(question.difficulty);

  return (
    <div style={{ padding: "0" }}>
      {/* Progress bar */}
      <div style={{ width: "100%", height: 4, background: "#2A2A38" }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
          style={{ height: "100%", background: "#00C97C" }}
        />
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 0" }}>
        {/* Question counter */}
        <p style={{ fontSize: 12, color: "#52526B", textAlign: "right", marginBottom: 16 }}>
          Question {currentIdx + 1} of {totalQuestions}
        </p>

        {/* Domain + difficulty tags */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, background: "#1C1C26", border: "1px solid #2A2A38", borderRadius: 100, padding: "3px 10px", color: "#8B8BA7" }}>
            {domainLabel}
          </span>
          <span style={{ fontSize: 11, color: "#F59E0B", padding: "3px 0" }}>
            {difficultyStars}
          </span>
        </div>

        {/* Question text */}
        <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6, color: "#F1F1F5", marginBottom: isMultiSelect ? 8 : 20 }}>
          <ReactMarkdown
            components={{
              code: ({ children, ...props }) => (
                <code
                  style={{
                    background: "#13131A",
                    border: "1px solid #2A2A38",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: 14,
                  }}
                  {...props}
                >
                  {children}
                </code>
              ),
              pre: ({ children, ...props }) => (
                <pre
                  style={{
                    background: "#13131A",
                    border: "1px solid #2A2A38",
                    borderRadius: 4,
                    padding: 12,
                    overflow: "auto",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: 14,
                  }}
                  {...props}
                >
                  {children}
                </pre>
              ),
            }}
          >
            {question.content}
          </ReactMarkdown>
        </div>

        {isMultiSelect && (
          <p style={{ fontSize: 12, color: "#F59E0B", marginBottom: 20 }}>
            (Select all that apply)
          </p>
        )}

        {/* Answer options */}
        <AnimatePresence mode="wait">
          <motion.div
            key={feedback ? "feedback" : "options"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Feedback label */}
            {feedback && (
              <p style={{ fontSize: 13, color: feedback.isCorrect ? "#4ADE80" : "#EF4444", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {feedback.isCorrect ? <Check size={16} /> : <X size={16} />}
                {feedback.isCorrect ? "Correct!" : "Incorrect"}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {question.options.map((option, optIdx) => {
                const isSelected = selectedIds.includes(option.id);
                const isCorrectOption = feedback?.correctOptionIds.includes(option.id);
                const isWrongSelection = feedback && isSelected && !isCorrectOption;
                const isRevealedCorrect = feedback && isCorrectOption;

                let borderColor = "#2A2A38";
                let bg = "#13131A";
                let textColor = "#F1F1F5";

                if (feedback) {
                  if (isRevealedCorrect) {
                    borderColor = "#4ADE80";
                    bg = "rgba(74,222,128,0.08)";
                    textColor = "#4ADE80";
                  } else if (isWrongSelection) {
                    borderColor = "#EF4444";
                    bg = "rgba(239,68,68,0.08)";
                    textColor = "#EF4444";
                  }
                } else if (isSelected) {
                  borderColor = "#00C97C";
                  bg = "rgba(0,201,124,0.063)";
                }

                const letter = String.fromCharCode(65 + optIdx);

                return (
                  <button
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    disabled={!!feedback}
                    style={{
                      width: "100%",
                      minHeight: 52,
                      background: bg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: 8,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      cursor: feedback ? "default" : "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (!feedback && !isSelected) e.currentTarget.style.borderColor = "#3D3D52";
                    }}
                    onMouseLeave={(e) => {
                      if (!feedback && !isSelected) e.currentTarget.style.borderColor = "#2A2A38";
                    }}
                  >
                    {/* Custom radio/checkbox */}
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: isMultiSelect ? 4 : "50%",
                        border: `2px solid ${isSelected || isRevealedCorrect ? "#00C97C" : "#3D3D52"}`,
                        background: isSelected || isRevealedCorrect ? "#00C97C" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {(isSelected || isRevealedCorrect) && (
                        <Check size={12} style={{ color: "#fff" }} />
                      )}
                    </div>

                    {/* Letter */}
                    <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "#52526B", flexShrink: 0, marginTop: 2 }}>
                      {letter}
                    </span>

                    {/* Text */}
                    <span style={{ flex: 1, fontSize: 14, color: textColor, lineHeight: 1.5 }}>
                      {option.text}
                    </span>

                    {/* Feedback icons */}
                    {feedback && isRevealedCorrect && (
                      <span style={{ fontSize: 12, color: "#4ADE80", flexShrink: 0, marginTop: 2 }}>✓ Correct</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hint panel */}
            {showHint && !feedback && (
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "12px 16px", marginTop: 12 }}>
                <p style={{ fontSize: 13, color: "#F59E0B", margin: 0 }}>
                  💡 Look for the option that best addresses the key requirements in the question. Consider AWS best practices and the Well-Architected Framework.
                </p>
                <p style={{ fontSize: 11, color: "#EF4444", margin: "8px 0 0 0" }}>-5 XP penalty applied</p>
              </div>
            )}

            {/* Explanation panel */}
            {feedback && (
              <div style={{ background: "#13131A", border: "1px solid #2A2A38", borderRadius: 8, padding: "16px 20px", marginTop: 16 }}>
                <p style={{ fontSize: 11, letterSpacing: "0.05em", color: "#52526B", marginBottom: 8, textTransform: "uppercase" }}>
                  Explanation
                </p>
                <div style={{ fontSize: 14, color: "#8B8BA7", lineHeight: 1.6 }}>
                  <ReactMarkdown>{feedback.explanation}</ReactMarkdown>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
                  {feedback.awsDocUrl && (
                    <a href={feedback.awsDocUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#00C97C", textDecoration: "none" }}>
                      AWS Documentation →
                    </a>
                  )}
                  <Link
                    href={`/tutor?questionId=${question.id}`}
                    onClick={() => setTutorContext({
                      questionId: question.id,
                      questionContent: question.content,
                      userAnswer: selectedIds.map((sid) => question.options.find((o) => o.id === sid)?.text ?? sid),
                      correctAnswer: feedback?.correctOptionIds.map((cid) => question.options.find((o) => o.id === cid)?.text ?? cid) ?? [],
                      explanation: feedback?.explanation,
                      domainName: DOMAIN_LABELS[question.domainId] ?? "AWS",
                      masteryPercent: feedback?.updatedMastery,
                    })}
                    style={{
                      height: 36,
                      border: "1px solid rgba(0,201,124,0.25)",
                      borderRadius: 6,
                      padding: "0 14px",
                      fontSize: 12,
                      color: "#00C97C",
                      background: "transparent",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Ask AI Tutor
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Control row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {!feedback && (
              <>
                <button onClick={handleHint} disabled={hintUsed} style={smallButtonStyle}>
                  <Lightbulb size={14} /> Hint
                </button>
                <button
                  onClick={toggleFlag}
                  style={{
                    ...smallButtonStyle,
                    borderColor: isFlagged ? "#F59E0B" : "#2A2A38",
                    color: isFlagged ? "#F59E0B" : "#8B8BA7",
                  }}
                >
                  <Flag size={14} fill={isFlagged ? "#F59E0B" : "none"} /> Flag
                </button>
              </>
            )}
          </div>

          {!feedback ? (
            <button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              style={{
                height: 44,
                background: selectedIds.length > 0 ? "#00C97C" : "#2A2A38",
                border: "none",
                borderRadius: 6,
                padding: "0 20px",
                fontSize: 14,
                fontWeight: 500,
                color: selectedIds.length > 0 ? "#fff" : "#52526B",
                cursor: selectedIds.length > 0 ? "pointer" : "default",
                opacity: selectedIds.length > 0 ? 1 : 0.4,
                fontFamily: "inherit",
              }}
            >
              Confirm
            </button>
          ) : (
            <button onClick={handleNext} style={nextButtonStyle}>
              {currentIdx >= totalQuestions - 1 ? "Finish Session" : "Next Question"} <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* XP float animation */}
        <AnimatePresence>
          {feedback && feedback.isCorrect && feedback.xpEarned > 0 && (
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -50 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              style={{
                position: "fixed",
                bottom: 100,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: 18,
                fontWeight: 700,
                color: "#00C97C",
                pointerEvents: "none",
                zIndex: 50,
              }}
            >
              +{feedback.xpEarned} XP
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function SummaryStat({
  value,
  label,
  color,
  icon,
  animate,
  levelUp,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
  animate?: boolean;
  levelUp?: boolean;
}) {
  const [displayed, setDisplayed] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate || value === 0) return;
    const duration = 1000;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayed(Math.round(progress * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, animate]);

  return (
    <div style={{ textAlign: "center" }}>
      {icon && <div style={{ marginBottom: 6 }}>{icon}</div>}
      {levelUp && (
        <p style={{ fontSize: 11, color: "#00C97C", margin: "0 0 4px 0", fontWeight: 600 }}>
          LEVEL UP!
        </p>
      )}
      <p style={{ fontSize: 28, fontFamily: "var(--font-geist-mono)", fontWeight: 700, color, margin: 0 }}>
        {displayed}
      </p>
      <p style={{ fontSize: 12, color: "#52526B", margin: "4px 0 0 0" }}>{label}</p>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const smallButtonStyle: React.CSSProperties = {
  height: 34,
  background: "transparent",
  border: "1px solid #2A2A38",
  borderRadius: 6,
  padding: "0 12px",
  fontSize: 12,
  color: "#8B8BA7",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "inherit",
};

const nextButtonStyle: React.CSSProperties = {
  height: 44,
  background: "#00C97C",
  border: "none",
  borderRadius: 6,
  padding: "0 20px",
  fontSize: 14,
  fontWeight: 500,
  color: "#fff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "inherit",
};

const summaryButtonPrimary: React.CSSProperties = {
  width: "100%",
  height: 48,
  background: "#00C97C",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  marginBottom: 10,
};

const summaryButtonSecondary: React.CSSProperties = {
  width: "100%",
  height: 48,
  background: "transparent",
  border: "1px solid #2A2A38",
  borderRadius: 6,
  fontSize: 14,
  color: "#8B8BA7",
  cursor: "pointer",
  fontFamily: "inherit",
};

// Wrap in Suspense for useSearchParams
export default function QuizPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24 }}>
          <div style={{ height: 4, background: "#2A2A38", marginBottom: 24 }} />
          <div style={{ height: 200, background: "#13131A", borderRadius: 8 }} className="animate-pulse" />
        </div>
      }
    >
      <QuizContent />
    </Suspense>
  );
}
