"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Check, X, ChevronLeft } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";
import { MOCK_PASSING_SCORE_PERCENT } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReviewFilter = "all" | "incorrect" | "flagged";

type WeekPlan = {
  week: number;
  focus: string[];
  activities: string[];
  dailyQuestionTarget: number;
  estimatedHours: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60000);
  return `${mins}m`;
}

function avgSecondsPerQuestion(
  startedAt: string,
  endedAt: string | null,
  total: number
): string {
  if (!endedAt || total === 0) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const avg = Math.round(ms / 1000 / total);
  return `${avg}s`;
}

function domainBarColor(score: number): string {
  if (score >= MOCK_PASSING_SCORE_PERCENT) return "#00C97C";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

function difficultyDots(difficulty: number): React.ReactNode {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: i < difficulty ? "#F59E0B" : "#2A2A38",
            display: "inline-block",
          }}
        />
      ))}
    </span>
  );
}

// ── Score animate hook ────────────────────────────────────────────────────────

function useAnimatedScore(scorePercent: number): number {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!scorePercent) return;
    const start = performance.now();
    const duration = 1500;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplayScore(Math.round(t * scorePercent));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [scorePercent]);

  return displayScore;
}

// ── Main content ──────────────────────────────────────────────────────────────

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId") ?? "";

  const [showReview, setShowReview] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [openExplanations, setOpenExplanations] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = trpc.mock.getResults.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const generatePlan = trpc.mock.generatePostExamPlan.useMutation();
  const [planWeeks, setPlanWeeks] = useState<WeekPlan[] | null>(null);

  useEffect(() => {
    if (!sessionId || generatePlan.isPending || planWeeks !== null) return;
    generatePlan.mutate(
      { sessionId },
      {
        onSuccess: (res) => {
          setPlanWeeks(res.weeks as WeekPlan[]);
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const scorePercent =
    data?.session && data.session.questionsAnswered > 0
      ? Math.round(
          (data.session.correctAnswers / data.session.questionsAnswered) * 100
        )
      : 0;

  const displayScore = useAnimatedScore(scorePercent);
  const passed = scorePercent >= MOCK_PASSING_SCORE_PERCENT;
  const scoreColor = passed ? "#00C97C" : "#EF4444";

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (!sessionId) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#52526B" }}>
        No session ID provided.{" "}
        <button
          onClick={() => router.push("/practice/mock")}
          style={{
            background: "none",
            border: "none",
            color: "#00C97C",
            cursor: "pointer",
            fontSize: "inherit",
          }}
        >
          Start a new exam
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 0" }}>
        {[120, 80, 200, 80].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              background: "#13131A",
              borderRadius: 8,
              marginBottom: 16,
            }}
            className="animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#EF4444" }}>
        Failed to load results. Please try again.
      </div>
    );
  }

  const { session, questions, domainResults, platformAverage } = data;

  const timeLimitMinutes =
    (session.config as Record<string, unknown>)?.timeLimitMinutes as
      | number
      | undefined;
  const timeTaken = formatDuration(session.startedAt, session.endedAt);
  const avgPerQ = avgSecondsPerQuestion(
    session.startedAt,
    session.endedAt,
    session.questionsAnswered
  );
  const minutesUsed = session.endedAt
    ? Math.floor(
        (new Date(session.endedAt).getTime() -
          new Date(session.startedAt).getTime()) /
          60000
      )
    : 0;

  // ── Question list for review ─────────────────────────────────────────────

  type QuestionResult = (typeof questions)[number];

  const allQuestions = (questions as NonNullable<QuestionResult>[]).filter(
    Boolean
  );
  const incorrectQuestions = allQuestions.filter((q) => !q.isCorrect);
  const flaggedQuestions = allQuestions.filter((q) => q.flagged);

  const filteredQuestions =
    reviewFilter === "all"
      ? allQuestions
      : reviewFilter === "incorrect"
      ? incorrectQuestions
      : flaggedQuestions;

  const toggleExplanation = (id: string) => {
    setOpenExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Review view ──────────────────────────────────────────────────────────

  if (showReview) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0 64px" }}>
        {/* Back button */}
        <button
          onClick={() => setShowReview(false)}
          style={{
            background: "none",
            border: "none",
            color: "#8B8BA7",
            cursor: "pointer",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          <ChevronLeft size={16} /> Back to Results
        </button>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#F1F1F5",
            marginTop: 12,
            marginBottom: 20,
          }}
        >
          Answer Review
        </h1>

        {/* Filter pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          {(
            [
              { key: "all", label: `All (${allQuestions.length})` },
              {
                key: "incorrect",
                label: `Incorrect (${incorrectQuestions.length})`,
              },
              {
                key: "flagged",
                label: `Flagged (${flaggedQuestions.length})`,
              },
            ] as { key: ReviewFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setReviewFilter(key)}
              style={{
                padding: "6px 16px",
                borderRadius: 100,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                background: reviewFilter === key ? "#00C97C" : "transparent",
                border:
                  reviewFilter === key ? "none" : "1px solid #2A2A38",
                color: reviewFilter === key ? "#0A0A0F" : "#52526B",
                fontWeight: reviewFilter === key ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Question cards */}
        {allQuestions.length === 0 ? (
          <div
            style={{
              background: "#13131A",
              border: "1px solid #2A2A38",
              borderRadius: 10,
              padding: "32px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#8B8BA7", fontSize: 15, marginBottom: 6 }}>
              Answer history not available for this session.
            </p>
            <p style={{ color: "#52526B", fontSize: 13, margin: 0 }}>
              This can happen if the session was submitted before a recent update.
              Complete a new mock exam to see the full answer review here.
            </p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <p style={{ color: "#52526B", fontSize: 14 }}>
            No questions match this filter.
          </p>
        ) : null}

        {filteredQuestions.map((q) => {
          const originalIndex = allQuestions.findIndex((aq) => aq.id === q.id);
          const isExplanationOpen = openExplanations.has(q.id);

          return (
            <div
              key={q.id}
              style={{
                background: "#13131A",
                border: "1px solid #2A2A38",
                borderRadius: 10,
                padding: 20,
                marginBottom: 12,
              }}
            >
              {/* Top row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-geist-mono)",
                    background: "#1C1C26",
                    border: "1px solid #2A2A38",
                    borderRadius: 4,
                    padding: "2px 8px",
                    color: "#52526B",
                  }}
                >
                  Q{originalIndex + 1}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    background: "#1C1C26",
                    border: "1px solid #2A2A38",
                    borderRadius: 4,
                    padding: "2px 8px",
                    color: "#8B8BA7",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {q.domainName}
                </span>
                {difficultyDots(q.difficulty)}
                <div style={{ marginLeft: "auto" }}>
                  {q.isCorrect ? (
                    <Check size={18} style={{ color: "#4ADE80" }} />
                  ) : (
                    <X size={18} style={{ color: "#EF4444" }} />
                  )}
                </div>
              </div>

              {/* Question text */}
              <div
                style={{
                  fontSize: 15,
                  color: "#F1F1F5",
                  marginTop: 12,
                  lineHeight: 1.6,
                }}
              >
                <ReactMarkdown
                  components={{
                    code: ({ children, ...props }) => (
                      <code
                        style={{
                          background: "#1C1C26",
                          border: "1px solid #2A2A38",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontFamily: "var(--font-geist-mono)",
                          fontSize: 13,
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    ),
                  }}
                >
                  {typeof q.content === "string"
                    ? q.content
                    : (q.content as Record<string, unknown>)?.text
                    ? String((q.content as Record<string, unknown>).text)
                    : JSON.stringify(q.content)}
                </ReactMarkdown>
              </div>

              {/* Options */}
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {q.options.map((option) => {
                  const userSelected = q.userSelectedIds.includes(option.id);
                  const isCorrectOption = option.isCorrect;

                  let bg = "#1C1C26";
                  let border = "1px solid #2A2A38";
                  let color = "#52526B";
                  let showCorrectLabel = false;

                  if (userSelected && isCorrectOption) {
                    bg = "rgba(74,222,128,0.08)";
                    border = "1px solid rgba(74,222,128,0.4)";
                    color = "#4ADE80";
                  } else if (userSelected && !isCorrectOption) {
                    bg = "rgba(239,68,68,0.08)";
                    border = "1px solid rgba(239,68,68,0.4)";
                    color = "#EF4444";
                  } else if (!userSelected && isCorrectOption) {
                    bg = "rgba(74,222,128,0.04)";
                    border = "1px solid rgba(74,222,128,0.2)";
                    color = "#4ADE80";
                    showCorrectLabel = true;
                  }

                  return (
                    <div
                      key={option.id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        fontSize: 13,
                        background: bg,
                        border,
                        color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ lineHeight: 1.5 }}>{option.text}</span>
                      {showCorrectLabel && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#4ADE80",
                            flexShrink: 0,
                            fontWeight: 600,
                          }}
                        >
                          ✓ Correct
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Show explanation toggle */}
              <button
                onClick={() => toggleExplanation(q.id)}
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: "#8B8BA7",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                }}
              >
                {isExplanationOpen ? "Hide Explanation ▲" : "Show Explanation ▼"}
              </button>

              {/* Explanation panel */}
              {isExplanationOpen && (
                <div
                  style={{
                    background: "#13131A",
                    border: "1px solid #2A2A38",
                    borderRadius: 8,
                    padding: 16,
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: "#8B8BA7",
                      lineHeight: 1.6,
                    }}
                  >
                    <ReactMarkdown>{q.explanation}</ReactMarkdown>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 12,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    {q.awsDocUrl && (
                      <a
                        href={q.awsDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12,
                          color: "#00C97C",
                          textDecoration: "none",
                        }}
                      >
                        AWS Documentation →
                      </a>
                    )}
                    <Link
                      href={`/tutor?questionId=${q.id}`}
                      style={{
                        fontSize: 12,
                        color: "#00C97C",
                        textDecoration: "none",
                      }}
                    >
                      Ask AI Tutor
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Results view ─────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ maxWidth: 720, margin: "0 auto", padding: "0 0 64px" }}
    >
      {/* ── Score reveal ── */}
      <div
        style={{
          paddingTop: 48,
          paddingBottom: 40,
          borderBottom: "1px solid #2A2A38",
          textAlign: "center",
        }}
      >
        {/* Animated score */}
        <div style={{ display: "inline-flex", alignItems: "flex-start" }}>
          <span
            style={{
              fontSize: 72,
              fontFamily: "var(--font-geist-mono)",
              fontWeight: 800,
              color: scoreColor,
              lineHeight: 1,
            }}
          >
            {displayScore}
          </span>
          <span
            style={{
              fontSize: 36,
              color: scoreColor,
              verticalAlign: "top",
              marginTop: 12,
              fontFamily: "var(--font-geist-mono)",
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            %
          </span>
        </div>

        {/* Pass/Fail badge */}
        <div style={{ marginTop: 16 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 100,
              padding: "8px 24px",
              fontSize: 13,
              letterSpacing: "0.1em",
              fontWeight: 700,
              background: passed ? "#00C97C20" : "#EF444420",
              border: passed ? "1px solid #00C97C40" : "1px solid #EF444440",
              color: passed ? "#00C97C" : "#EF4444",
            }}
          >
            {passed ? "PASSED" : "DIDN'T PASS"}
          </span>
        </div>

        {/* Passing score label */}
        <p
          style={{
            fontSize: 12,
            color: "#52526B",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Passing score: {MOCK_PASSING_SCORE_PERCENT}%
        </p>

        {/* XP earned pill */}
        {session.xpEarned > 0 && (
          <div style={{ marginTop: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 100,
                padding: "4px 14px",
                fontSize: 12,
                fontWeight: 600,
                background: "#00C97C20",
                border: "1px solid #00C97C40",
                color: "#00C97C",
              }}
            >
              +{session.xpEarned} XP
            </span>
          </div>
        )}

        {/* Time taken */}
        <p
          style={{
            fontSize: 12,
            fontFamily: "var(--font-geist-mono)",
            color: "#52526B",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          {timeTaken} · avg {avgPerQ}/question
        </p>
      </div>

      {/* ── Domain breakdown ── */}
      <div
        style={{ marginTop: 36, maxWidth: 680, margin: "36px auto 0" }}
      >
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#F1F1F5",
            marginBottom: 16,
          }}
        >
          By Domain
        </p>

        {domainResults.map((domain, index) => {
          const barColor = domainBarColor(domain.scorePercent);
          const weightValue =
            (domain as typeof domain & { weight?: number }).weight;

          return (
            <div
              key={domain.domainId}
              style={{
                height: 44,
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderBottom:
                  index < domainResults.length - 1
                    ? "1px solid #2A2A38"
                    : "none",
              }}
            >
              {/* Domain name */}
              <span
                style={{
                  fontSize: 13,
                  color: "#8B8BA7",
                  width: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {domain.domainName}
              </span>

              {/* Score bar */}
              <div
                style={{
                  flex: 1,
                  height: 8,
                  background: "#2A2A38",
                  borderRadius: 100,
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${domain.scorePercent}%` }}
                  transition={{ delay: index * 0.1, duration: 0.6 }}
                  style={{
                    height: "100%",
                    background: barColor,
                    borderRadius: 100,
                  }}
                />
              </div>

              {/* Score % */}
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-geist-mono)",
                  width: 40,
                  textAlign: "right",
                  color: barColor,
                  flexShrink: 0,
                }}
              >
                {domain.scorePercent}%
              </span>

              {/* Weight badge */}
              {weightValue != null && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#52526B",
                    flexShrink: 0,
                    width: 36,
                  }}
                >
                  ({weightValue}%)
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Stats row ── */}
      <div
        style={{
          marginTop: 28,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Platform avg */}
        <div style={statCardStyle}>
          <p style={statValueStyle}>{platformAverage}%</p>
          <p style={statLabelStyle}>Platform Avg</p>
        </div>

        {/* Time used */}
        <div style={statCardStyle}>
          <p style={statValueStyle}>
            {minutesUsed} / {timeLimitMinutes ?? "—"} min
          </p>
          <p style={statLabelStyle}>Time Used</p>
        </div>

        {/* Correct */}
        <div style={statCardStyle}>
          <p style={statValueStyle}>
            {session.correctAnswers} / {session.questionsAnswered}
          </p>
          <p style={statLabelStyle}>Correct</p>
        </div>
      </div>

      {/* ── Post-exam study plan ── */}
      <div style={{ marginTop: 36 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#F1F1F5",
            marginBottom: 16,
          }}
        >
          Your Study Plan
        </p>

        {generatePlan.isPending || planWeeks === null ? (
          /* Shimmer skeletons */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 56,
                  borderRadius: 8,
                  background:
                    "linear-gradient(90deg, #13131A 25%, #1C1C26 50%, #13131A 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.4s infinite",
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Callout */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#F59E0B",
                marginBottom: 12,
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              Focus areas updated based on your exam results
            </div>

            {/* Week cards */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              {planWeeks.map((week) => (
                <div
                  key={week.week}
                  style={{
                    background: "#13131A",
                    border: "1px solid #2A2A38",
                    borderRadius: 10,
                    padding: "16px 20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#00C97C",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Week {week.week}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#52526B",
                        fontFamily: "var(--font-geist-mono)",
                      }}
                    >
                      ~{week.estimatedHours}h · {week.dailyQuestionTarget}q/day
                    </span>
                  </div>

                  {/* Focus tags */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    {week.focus.map((f) => (
                      <span
                        key={f}
                        style={{
                          fontSize: 11,
                          background: "#1C1C26",
                          border: "1px solid #2A2A38",
                          borderRadius: 100,
                          padding: "2px 10px",
                          color: "#8B8BA7",
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  {/* Activities */}
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {week.activities.map((a) => (
                      <li
                        key={a}
                        style={{ fontSize: 13, color: "#8B8BA7", lineHeight: 1.5 }}
                      >
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div
        style={{
          marginTop: 32,
          maxWidth: 400,
          margin: "32px auto 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <button
          onClick={() => setShowReview(true)}
          style={{
            height: 52,
            border: "1px solid #2A2A38",
            borderRadius: 8,
            fontSize: 14,
            color: "#F1F1F5",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Review All Answers
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          style={{
            height: 52,
            background: "#00C97C",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "#0A0A0F",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Back to Dashboard
        </button>

        <button
          onClick={() => router.push("/practice/mock")}
          style={{
            height: 44,
            background: "transparent",
            border: "none",
            fontSize: 13,
            color: "#52526B",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Retake Exam
        </button>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
}

// ── Stat card styles ──────────────────────────────────────────────────────────

const statCardStyle: React.CSSProperties = {
  background: "#13131A",
  border: "1px solid #2A2A38",
  borderRadius: 8,
  padding: 16,
  textAlign: "center",
  flex: 1,
  minWidth: 100,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontFamily: "var(--font-geist-mono)",
  color: "#F1F1F5",
  margin: 0,
  fontWeight: 600,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8B8BA7",
  margin: "4px 0 0 0",
};

// ── Page export ───────────────────────────────────────────────────────────────

export default function MockResultsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 0" }}>
          {[120, 80, 200].map((h, i) => (
            <div
              key={i}
              style={{
                height: h,
                background: "#13131A",
                borderRadius: 8,
                marginBottom: 16,
              }}
              className="animate-pulse"
            />
          ))}
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
