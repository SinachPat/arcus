"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Flag } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useMockExamStore } from "@/store/mockExam";
import { MOCK_TIME_WARNING_MINUTES, MOCK_TIME_CRITICAL_MINUTES } from "@/lib/constants";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const markdownComponents = {
  code: ({ children, ...props }: React.ComponentPropsWithoutRef<"code">) => (
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
  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) => (
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
};

// ── Pulse keyframes injected once ────────────────────────────────────────────

const PULSE_STYLE_ID = "mock-exam-pulse";

function ensurePulseKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes mockPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .mock-timer-pulse {
      animation: mockPulse 1s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

// ── Main session content ──────────────────────────────────────────────────────

function MockSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const store = useMockExamStore();

  const sessionIdParam = searchParams.get("sessionId") ?? "";

  // UI state
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [navPanelOpen, setNavPanelOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showWarning, setShowWarning] = useState<"fifteen" | "five" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Warning fired trackers (refs to avoid stale closure issues)
  const warnedFifteenRef = useRef(false);
  const warnedFiveRef = useRef(false);
  const autoSubmittedRef = useRef(false);

  const submitMutation = trpc.mock.submit.useMutation();

  // ── Initialize on mount ──
  useEffect(() => {
    ensurePulseKeyframes();

    if (!sessionIdParam) {
      router.replace("/practice/mock");
      return;
    }

    const restored = store.restore(sessionIdParam);
    if (!restored && store.sessionId !== sessionIdParam) {
      router.replace("/practice/mock");
      return;
    }

    setInitialized(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown interval ──
  useEffect(() => {
    if (!initialized || !store.startedAt || store.submitted) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(store.startedAt!).getTime()) / 1000);
      const remaining = Math.max(0, store.timeLimitSeconds - elapsed);
      setRemainingSeconds(remaining);
      return remaining;
    };

    // Initial tick
    tick();

    const id = setInterval(() => {
      const remaining = tick();
      if (remaining <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        clearInterval(id);
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, store.startedAt, store.timeLimitSeconds, store.submitted]);

  // ── Warning banners ──
  useEffect(() => {
    // Don't fire until the timer has actually started (remainingSeconds > 0)
    if (!initialized || remainingSeconds <= 0) return;
    const fifteenThreshold = MOCK_TIME_WARNING_MINUTES * 60;
    const fiveThreshold = MOCK_TIME_CRITICAL_MINUTES * 60;

    if (remainingSeconds <= fiveThreshold && !warnedFiveRef.current) {
      warnedFiveRef.current = true;
      setShowWarning("five");
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(200);
      }
      setTimeout(() => setShowWarning(null), 5000);
    } else if (remainingSeconds <= fifteenThreshold && !warnedFifteenRef.current) {
      warnedFifteenRef.current = true;
      setShowWarning("fifteen");
      setTimeout(() => setShowWarning(null), 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, initialized]);

  // ── beforeunload persist ──
  useEffect(() => {
    if (!initialized) return;
    const handler = () => store.persist();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  // ── Handlers ──
  const handleAutoSubmit = useCallback(async () => {
    await performSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const performSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const elapsed = Math.floor((Date.now() - new Date(store.startedAt!).getTime()) / 1000);
    const totalTimeSeconds = Math.min(elapsed, store.timeLimitSeconds);

    const storeFlags: string[] = Array.isArray(store.flags)
      ? (store.flags as unknown as string[])
      : Array.from(store.flags as unknown as Set<string>);

    const answers = store.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: store.answers[q.id] ?? [],
      flagged: storeFlags.includes(q.id),
    }));

    try {
      await submitMutation.mutateAsync({
        sessionId: store.sessionId!,
        answers,
        totalTimeSeconds,
      });
      store.markSubmitted();
      router.push(`/practice/mock/results?sessionId=${store.sessionId}`);
    } catch (err) {
      console.error("Failed to submit exam:", err);
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitting, store, submitMutation, router]);

  const handleOptionClick = useCallback(
    (questionId: string, optionId: string, type: string) => {
      if (type === "multi_select") {
        const current = store.answers[questionId] ?? [];
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        store.setAnswer(questionId, next);
      } else {
        store.setAnswer(questionId, [optionId]);
      }
    },
    [store]
  );

  // ── Not yet initialized ──
  if (!initialized) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0A0F" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #2A2A38", borderTopColor: "#00C97C", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const questions = store.questions;
  const currentIndex = store.currentIndex;
  const total = questions.length;
  const question = questions[currentIndex];

  if (!question) return null;

  const isMultiSelect = question.type === "multi_select";
  const selectedIds = store.answers[question.id] ?? [];
  const flagsArray: string[] = Array.isArray(store.flags)
    ? (store.flags as unknown as string[])
    : Array.from(store.flags as unknown as Set<string>);
  const isFlagged = flagsArray.includes(question.id);

  const answeredCount = Object.keys(store.answers).filter(
    (qId) => (store.answers[qId] ?? []).length > 0
  ).length;
  const flaggedCount = flagsArray.length;
  const unansweredCount = total - answeredCount;

  // Timer color
  const fifteenSec = MOCK_TIME_WARNING_MINUTES * 60;
  const fiveSec = MOCK_TIME_CRITICAL_MINUTES * 60;
  let timerColor = "#F1F1F5";
  if (remainingSeconds <= fiveSec) timerColor = "#EF4444";
  else if (remainingSeconds <= fifteenSec) timerColor = "#F59E0B";

  const timerPulsing = remainingSeconds <= fiveSec;

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0F", display: "flex", flexDirection: "column" }}>

      {/* ── Time warning banners ── */}
      {showWarning === "fifteen" && (
        <div style={{
          height: 40,
          background: "#F59E0B15",
          borderBottom: "1px solid #F59E0B40",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "#F59E0B",
          position: "sticky",
          top: 56,
          zIndex: 9,
        }}>
          ⏱ 15 minutes remaining
        </div>
      )}
      {showWarning === "five" && (
        <div style={{
          height: 40,
          background: "#EF444415",
          borderBottom: "1px solid #EF444440",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "#EF4444",
          position: "sticky",
          top: 56,
          zIndex: 9,
        }}>
          ⚠️ 5 minutes remaining
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{
        position: "sticky",
        top: 0,
        height: 56,
        background: "#0A0A0F",
        borderBottom: "1px solid #2A2A38",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
      }}>
        {/* Left: question counter */}
        <span style={{
          fontSize: 13,
          fontFamily: "var(--font-geist-mono)",
          color: "#8B8BA7",
          flexShrink: 0,
          minWidth: 80,
        }}>
          Q{currentIndex + 1} / {total}
        </span>

        {/* Center: progress bar */}
        <div style={{ flex: 1, height: 3, background: "#2A2A38", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            background: "#00C97C",
            width: `${total > 0 ? (currentIndex / total) * 100 : 0}%`,
            transition: "width 0.3s ease",
            borderRadius: 2,
          }} />
        </div>

        {/* Right: Questions button + timer */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => setNavPanelOpen((v) => !v)}
            style={{
              height: 30,
              background: "transparent",
              border: "1px solid #2A2A38",
              borderRadius: 6,
              padding: "0 10px",
              fontSize: 12,
              color: "#8B8BA7",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Questions
          </button>
          <span
            className={timerPulsing ? "mock-timer-pulse" : ""}
            style={{
              fontSize: 13,
              fontFamily: "var(--font-geist-mono)",
              color: timerColor,
              minWidth: 60,
              textAlign: "right",
            }}
          >
            {formatTime(remainingSeconds)}
          </span>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Question area ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 20px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>

            {/* Q badge + difficulty */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{
                fontSize: 11,
                fontFamily: "var(--font-geist-mono)",
                background: "#1C1C26",
                border: "1px solid #2A2A38",
                borderRadius: 4,
                padding: "3px 8px",
                color: "#52526B",
              }}>
                Q{currentIndex + 1}
              </span>
              <div style={{ display: "flex", gap: 3 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ color: i < question.difficulty ? "#F59E0B" : "#2A2A38", fontSize: 12 }}>
                    ●
                  </span>
                ))}
              </div>
            </div>

            {/* Question text */}
            <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.65, color: "#F1F1F5", marginBottom: isMultiSelect ? 8 : 20 }}>
              <ReactMarkdown components={markdownComponents}>
                {typeof question.content === "string" ? question.content : JSON.stringify(question.content)}
              </ReactMarkdown>
            </div>

            {/* Multi-select hint */}
            {isMultiSelect && (
              <p style={{ fontSize: 12, color: "#F59E0B", marginBottom: 20 }}>
                (Select all that apply)
              </p>
            )}

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {question.options.map((option, optIdx) => {
                const isSelected = selectedIds.includes(option.id);
                const borderColor = isSelected ? "#00C97C" : "#2A2A38";
                const bg = isSelected ? "rgba(0,201,124,0.063)" : "#13131A";
                const textColor = "#F1F1F5";
                const letter = String.fromCharCode(65 + optIdx);

                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionClick(question.id, option.id, question.type)}
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
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = "#3D3D52";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = "#2A2A38";
                    }}
                  >
                    {/* Radio / checkbox indicator */}
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: isMultiSelect ? 4 : "50%",
                      border: `2px solid ${isSelected ? "#00C97C" : "#3D3D52"}`,
                      background: isSelected ? "#00C97C" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Letter */}
                    <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "#52526B", flexShrink: 0, marginTop: 2 }}>
                      {letter}
                    </span>

                    {/* Option text */}
                    <span style={{ flex: 1, fontSize: 14, color: textColor, lineHeight: 1.5 }}>
                      {option.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Flag button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                onClick={() => store.toggleFlag(question.id)}
                style={{
                  height: 36,
                  border: `1px solid ${isFlagged ? "rgba(245,158,11,0.4)" : "#2A2A38"}`,
                  borderRadius: 6,
                  background: isFlagged ? "rgba(245,158,11,0.08)" : "transparent",
                  padding: "0 12px",
                  fontSize: 12,
                  color: isFlagged ? "#F59E0B" : "#52526B",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "inherit",
                  transition: "border-color 0.15s, background 0.15s, color 0.15s",
                }}
              >
                <Flag
                  size={14}
                  fill={isFlagged ? "#F59E0B" : "none"}
                  stroke={isFlagged ? "#F59E0B" : "currentColor"}
                />
                {isFlagged ? "Flagged" : "Flag for Review"}
              </button>
            </div>

            {/* Navigation row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <button
                onClick={() => store.setCurrentIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
                style={{
                  height: 40,
                  border: currentIndex === 0 ? "1px solid #2A2A38" : "1px solid #00C97C",
                  borderRadius: 6,
                  background: "transparent",
                  padding: "0 16px",
                  fontSize: 13,
                  color: currentIndex === 0 ? "#3D3D52" : "#00C97C",
                  cursor: currentIndex === 0 ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: currentIndex === 0 ? 0.35 : 1,
                }}
              >
                ← Previous
              </button>

              {currentIndex < total - 1 ? (
                <button
                  onClick={() => store.setCurrentIndex(currentIndex + 1)}
                  style={{
                    height: 40,
                    border: "1px solid #00C97C",
                    borderRadius: 6,
                    background: "transparent",
                    padding: "0 16px",
                    fontSize: 13,
                    color: "#00C97C",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  style={{
                    height: 40,
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.08)",
                    padding: "0 16px",
                    fontSize: 13,
                    color: "#EF4444",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 500,
                  }}
                >
                  Review & Submit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop nav panel ── */}
        <div style={{
          width: 220,
          borderLeft: "1px solid #2A2A38",
          padding: 16,
          overflowY: "auto",
          flexShrink: 0,
          display: "none",
        }}
          className="mock-nav-desktop"
        >
          <NavPanelContent
            questions={questions}
            currentIndex={currentIndex}
            answers={store.answers}
            flags={flagsArray}
            answeredCount={answeredCount}
            flaggedCount={flaggedCount}
            onSelectIndex={(i) => store.setCurrentIndex(i)}
            onSubmitClick={() => setShowSubmitModal(true)}
          />
        </div>
      </div>

      {/* ── Mobile nav panel (bottom sheet) ── */}
      {navPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setNavPanelOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 99,
            }}
          />
          {/* Sheet */}
          <div style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#13131A",
            borderTop: "1px solid #2A2A38",
            borderRadius: "16px 16px 0 0",
            padding: 16,
            zIndex: 100,
            maxHeight: "60vh",
            overflowY: "auto",
          }}>
            <NavPanelContent
              questions={questions}
              currentIndex={currentIndex}
              answers={store.answers}
              flags={flagsArray}
              answeredCount={answeredCount}
              flaggedCount={flaggedCount}
              onSelectIndex={(i) => { store.setCurrentIndex(i); setNavPanelOpen(false); }}
              onSubmitClick={() => { setNavPanelOpen(false); setShowSubmitModal(true); }}
            />
          </div>
        </>
      )}

      {/* ── Desktop nav panel visibility via style injection ── */}
      <style>{`
        @media (min-width: 768px) {
          .mock-nav-desktop { display: block !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Submit confirmation modal ── */}
      {showSubmitModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "#13131A",
            border: "1px solid #2A2A38",
            borderRadius: 12,
            padding: 28,
            maxWidth: 360,
            width: "100%",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>
              Submit exam?
            </h2>

            {unansweredCount > 0 && (
              <p style={{ fontSize: 13, color: "#F59E0B", margin: "12px 0 0 0" }}>
                {unansweredCount} {unansweredCount === 1 ? "question" : "questions"} unanswered
              </p>
            )}

            <p style={{ fontSize: 13, color: "#8B8BA7", marginTop: 8 }}>
              You cannot change your answers after submitting.
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  height: 44,
                  border: "1px solid #2A2A38",
                  borderRadius: 6,
                  background: "transparent",
                  fontSize: 13,
                  color: "#8B8BA7",
                  cursor: isSubmitting ? "default" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={performSubmit}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  height: 44,
                  border: "none",
                  borderRadius: 6,
                  background: isSubmitting ? "#6B2020" : "#EF4444",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: isSubmitting ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nav panel shared content ──────────────────────────────────────────────────

interface Question {
  id: string;
  type: string;
  content: unknown;
  difficulty: number;
  options: Array<{ id: string; text: string }>;
}

interface NavPanelContentProps {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string[]>;
  flags: string[];
  answeredCount: number;
  flaggedCount: number;
  onSelectIndex: (i: number) => void;
  onSubmitClick: () => void;
}

function NavPanelContent({
  questions,
  currentIndex,
  answers,
  flags,
  answeredCount,
  flaggedCount,
  onSelectIndex,
  onSubmitClick,
}: NavPanelContentProps) {
  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#F1F1F5", margin: "0 0 12px 0" }}>
        Questions
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {questions.map((q, i) => {
          const isCurrent = i === currentIndex;
          const isAnswered = (answers[q.id] ?? []).length > 0;
          const isFlagged = flags.includes(q.id);

          let bg = "#1C1C26";
          let borderStyle = "none";
          let color = "#52526B";

          if (isCurrent) {
            bg = "transparent";
            borderStyle = "2px solid #F1F1F5";
            color = "#F1F1F5";
          } else if (isFlagged) {
            bg = "#F59E0B20";
            borderStyle = "1px solid #F59E0B40";
            color = "#F59E0B";
          } else if (isAnswered) {
            bg = "#00C97C20";
            borderStyle = "1px solid #00C97C40";
            color = "#00C97C";
          }

          return (
            <button
              key={q.id}
              onClick={() => onSelectIndex(i)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                border: borderStyle,
                background: bg,
                color,
                fontSize: 12,
                fontFamily: "var(--font-geist-mono)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontWeight: isCurrent ? 600 : 400,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 12, color: "#8B8BA7", margin: "0 0 4px 0" }}>
          Answered: {answeredCount} / {questions.length}
        </p>
        {flaggedCount > 0 && (
          <p style={{ fontSize: 12, color: "#F59E0B", margin: 0 }}>
            Flagged: {flaggedCount}
          </p>
        )}
      </div>

      <button
        onClick={onSubmitClick}
        style={{
          marginTop: 16,
          width: "100%",
          height: 44,
          background: "rgba(239,68,68,0.13)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 6,
          fontSize: 13,
          color: "#EF4444",
          cursor: "pointer",
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        Submit Exam
      </button>
    </div>
  );
}

// ── Page export with Suspense ─────────────────────────────────────────────────

export default function MockSessionPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0A0A0F" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid #2A2A38", borderTopColor: "#00C97C",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <MockSessionContent />
    </Suspense>
  );
}
