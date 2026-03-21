"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

interface DiagnosticQuizProps {
  examId:    string;
  onNext:    () => void;
  onResults: (results: {
    readinessScore: number;
    domainScores:   Record<string, number>;
    sessionId:      string | null;
    xpEarned:       number;
  }) => void;
}

interface QuestionOption {
  id:        string;
  text:      string;
  isCorrect: boolean;
}

interface QuestionData {
  id:         string;
  domainId:   string;
  type:       string;
  content:    string;
  difficulty: number;
  options:    QuestionOption[];
}

interface AnswerRecord {
  questionId:        string;
  selectedOptionIds: string[];
  correct:           boolean;
  difficulty:        number;
  domainId:          string;
}

export default function DiagnosticQuiz({ examId, onNext, onResults }: DiagnosticQuizProps) {
  const { data: rawQuestions, isLoading } = trpc.onboarding.getQuestions.useQuery({ examId });
  const submitMutation = trpc.onboarding.submitDiagnostic.useMutation();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Adaptive difficulty tracking
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [consecutiveIncorrect, setConsecutiveIncorrect] = useState(0);
  const [currentDifficulty, setCurrentDifficulty] = useState(3);

  // Timer — counts up
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const questions: QuestionData[] = (rawQuestions ?? []) as QuestionData[];
  const question = questions[currentIdx];
  const isMultiSelect = question?.type === "multi_select";
  const totalQuestions = questions.length;

  const toggleOption = useCallback(
    (optionId: string) => {
      if (showFeedback) return;
      if (isMultiSelect) {
        setSelectedIds((prev) =>
          prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
        );
      } else {
        setSelectedIds([optionId]);
      }
    },
    [showFeedback, isMultiSelect]
  );

  const confirmAnswer = useCallback(() => {
    if (!question || selectedIds.length === 0 || showFeedback) return;

    // Grade locally
    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    const correct =
      selectedIds.length === correctIds.length &&
      selectedIds.every((id) => correctIds.includes(id));

    setIsCorrect(correct);
    setShowFeedback(true);

    // Track answer
    const answer: AnswerRecord = {
      questionId:        question.id,
      selectedOptionIds: selectedIds,
      correct,
      difficulty:        currentDifficulty,
      domainId:          question.domainId,
    };
    setAnswers((prev) => [...prev, answer]);

    // Update adaptive difficulty
    if (correct) {
      const newConsecutive = consecutiveCorrect + 1;
      setConsecutiveCorrect(newConsecutive);
      setConsecutiveIncorrect(0);
      if (newConsecutive >= 2) {
        setCurrentDifficulty((d) => Math.min(5, d + 1));
        setConsecutiveCorrect(0);
      }
    } else {
      const newConsecutive = consecutiveIncorrect + 1;
      setConsecutiveIncorrect(newConsecutive);
      setConsecutiveCorrect(0);
      if (newConsecutive >= 2) {
        setCurrentDifficulty((d) => Math.max(1, d - 1));
        setConsecutiveIncorrect(0);
      }
    }

    // Auto-advance after 1.5s
    setTimeout(() => {
      setShowFeedback(false);
      setSelectedIds([]);

      if (currentIdx < totalQuestions - 1) {
        setCurrentIdx((i) => i + 1);
      } else {
        // Quiz complete — submit results
        handleSubmit([...answers, answer]);
      }
    }, 1500);
  }, [
    question,
    selectedIds,
    showFeedback,
    currentDifficulty,
    consecutiveCorrect,
    consecutiveIncorrect,
    currentIdx,
    totalQuestions,
    answers,
  ]);

  // Auto-submit for single-choice questions
  useEffect(() => {
    if (!isMultiSelect && selectedIds.length === 1 && !showFeedback) {
      confirmAnswer();
    }
  }, [selectedIds, isMultiSelect, showFeedback, confirmAnswer]);

  const handleSubmit = async (finalAnswers: AnswerRecord[]) => {
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const result = await submitMutation.mutateAsync({
        examId,
        answers: finalAnswers,
      });

      // Brief loading pause
      await new Promise((r) => setTimeout(r, 1000));

      onResults(result);
      onNext();
    } catch (err) {
      console.error("Failed to submit diagnostic:", err);
      setSubmitting(false);
    }
  };

  // Timer display
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timerDisplay = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Loading shimmer
  if (isLoading) {
    return (
      <div>
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            color: "#52526B",
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          Step 3 of 5
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F1F1F5", margin: 0 }}>
          Quick diagnostic
        </h1>
        <p style={{ fontSize: 15, color: "#8B8BA7", marginTop: 8, marginBottom: 28 }}>
          Loading questions...
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 52,
                background: "#13131A",
                borderRadius: 8,
                border: "1px solid #2A2A38",
              }}
              className="animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Submitting state
  if (submitting) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid #2A2A38",
            borderTopColor: "#00C97C",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ fontSize: 16, color: "#8B8BA7", marginTop: 16 }}>
          Calculating your results...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!question) return null;

  const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);

  return (
    <div>
      {/* Step label */}
      <p
        style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          color: "#52526B",
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        Step 3 of 5
      </p>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F1F1F5", margin: 0 }}>
            Quick diagnostic
          </h1>
          <p style={{ fontSize: 15, color: "#8B8BA7", marginTop: 8, marginBottom: 0 }}>
            20 questions to calibrate your study plan. Answer honestly — there&apos;s no penalty.
          </p>
        </div>
        <span
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 16,
            color: "#8B8BA7",
            flexShrink: 0,
            marginLeft: 16,
            marginTop: 4,
          }}
        >
          {timerDisplay}
        </span>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
        >
          {/* Question number */}
          <p style={{ fontSize: 12, color: "#52526B", marginBottom: 12 }}>
            {currentIdx + 1} / {totalQuestions}
          </p>

          {/* Question content */}
          <div
            style={{ fontSize: 16, fontWeight: 500, color: "#F1F1F5", marginBottom: 4 }}
          >
            <ReactMarkdown>{question.content}</ReactMarkdown>
          </div>

          {isMultiSelect && (
            <p style={{ fontSize: 12, color: "#8B8BA7", marginBottom: 16 }}>
              (Select all that apply)
            </p>
          )}

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {question.options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              const isCorrectOption = correctOptionIds.includes(option.id);
              const isWrongSelection = showFeedback && isSelected && !isCorrectOption;
              const isRevealedCorrect = showFeedback && isCorrectOption;

              let borderColor = "#2A2A38";
              let bg = "#13131A";
              let textColor = "#F1F1F5";

              if (showFeedback) {
                if (isRevealedCorrect) {
                  borderColor = "#4ADE80";
                  bg = "rgba(74, 222, 128, 0.08)";
                  textColor = "#4ADE80";
                } else if (isWrongSelection) {
                  borderColor = "#EF4444";
                  bg = "rgba(239, 68, 68, 0.08)";
                  textColor = "#EF4444";
                }
              } else if (isSelected) {
                borderColor = "#00C97C";
                bg = "rgba(0, 201, 124, 0.063)";
                textColor = "#00C97C";
              }

              return (
                <button
                  key={option.id}
                  onClick={() => toggleOption(option.id)}
                  disabled={showFeedback}
                  style={{
                    width: "100%",
                    minHeight: 52,
                    background: bg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: "12px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: textColor,
                    cursor: showFeedback ? "default" : "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    fontFamily: "inherit",
                    textAlign: "left",
                    gap: 12,
                  }}
                >
                  <span style={{ flex: 1 }}>{option.text}</span>
                  {showFeedback && isRevealedCorrect && (
                    <Check size={18} style={{ color: "#4ADE80", flexShrink: 0 }} />
                  )}
                  {showFeedback && isWrongSelection && (
                    <X size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Confirm button for multi-select */}
          {isMultiSelect && selectedIds.length > 0 && !showFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 16 }}
            >
              <button
                onClick={confirmAnswer}
                style={{
                  width: "100%",
                  height: 48,
                  background: "#00C97C",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Confirm Answer
              </button>
            </motion.div>
          )}

          {/* XP float animation */}
          <AnimatePresence>
            {showFeedback && isCorrect && (
              <motion.div
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -40 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1 }}
                style={{
                  position: "fixed",
                  bottom: 120,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#00C97C",
                  pointerEvents: "none",
                }}
              >
                +10 XP
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
