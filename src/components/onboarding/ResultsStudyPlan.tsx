"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { SelfAssessmentData } from "@/app/onboarding/page";

interface ResultsStudyPlanProps {
  examId: string;
  diagnosticResults: {
    readinessScore: number;
    domainScores:   Record<string, number>;
    sessionId:      string | null;
    xpEarned:       number;
  };
  selfAssessment: SelfAssessmentData;
  onNext:          () => void;
  onPlanGenerated: (plan: {
    estimatedDaysToReadiness: number;
    weeklyPlan: Array<{
      weekNumber:   number;
      focusDomains: string[];
      dailyMinutes: number;
      goals:        string[];
    }>;
    priorityDomains: string[];
  }) => void;
}

/** Map self-assessment study hours to numeric value. */
function parseHoursPerWeek(studyHours: string): number {
  if (studyHours.includes("10+")) return 12;
  if (studyHours.includes("5")) return 7;
  if (studyHours.includes("2")) return 3;
  return 1;
}

/** Map self-assessment target date to a string the AI understands. */
function parseTargetTimeframe(targetDate: string): string | undefined {
  if (targetDate.includes("2 weeks")) return "within 2 weeks";
  if (targetDate.includes("2\u20134") || targetDate.includes("2-4")) return "2-4 weeks";
  if (targetDate.includes("1\u20133") || targetDate.includes("1-3")) return "1-3 months";
  if (targetDate.includes("3+")) return "3+ months";
  return undefined;
}

/** Fetch domain names so we can label the bars. */
function useDomainNames(examId: string) {
  const { data } = trpc.onboarding.getExams.useQuery();
  // We can also use domain names from the scores
  void examId;
  void data;
  return null; // We'll label with domain IDs for now, mapped below
}

/** Human-readable domain labels keyed by the constant domain IDs. */
const DOMAIN_LABELS: Record<string, string> = {
  "b1000000-0000-4000-8000-000000000001": "Resilient Architectures",
  "b1000000-0000-4000-8000-000000000002": "High-Performing",
  "b1000000-0000-4000-8000-000000000003": "Secure Applications",
  "b1000000-0000-4000-8000-000000000004": "Cost-Optimized",
  "b1000000-0000-4000-8000-000000000005": "Operationally Excellent",
  "b1000000-0000-4000-8000-000000000006": "Continuous Improvement",
};

function scoreColor(score: number): string {
  if (score < 40) return "#EF4444";
  if (score < 70) return "#F59E0B";
  return "#4ADE80";
}

function scoreTierLabel(score: number): { text: string; color: string } {
  if (score < 40) return { text: "Needs work", color: "#EF4444" };
  if (score < 70) return { text: "Getting there", color: "#F59E0B" };
  return { text: "Looking good", color: "#4ADE80" };
}

/** Build a simple local fallback plan from the data we already have. */
function buildFallbackPlan(domainScores: Record<string, number>, hoursPerWeek: number) {
  const dailyMinutes = Math.max(15, Math.round((hoursPerWeek * 60) / 7));
  const weakDomainIds = Object.entries(domainScores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([id]) => DOMAIN_LABELS[id] ?? "Core AWS");
  return {
    estimatedDaysToReadiness: 56,
    weeklyPlan: Array.from({ length: 8 }, (_, i) => ({
      weekNumber: i + 1,
      focusDomains: weakDomainIds,
      dailyMinutes,
      goals: [
        `Complete ${Math.round(dailyMinutes / 3)} practice questions`,
        "Review incorrect answers with AI tutor",
        "Focus on high-weight exam domains",
      ],
    })),
    priorityDomains: weakDomainIds,
  };
}

export default function ResultsStudyPlan({
  examId,
  diagnosticResults,
  selfAssessment,
  onNext,
  onPlanGenerated,
}: ResultsStudyPlanProps) {
  void useDomainNames(examId); // warm cache
  const [animatedScore, setAnimatedScore] = useState(0);
  const [scoreAnimDone, setScoreAnimDone] = useState(false);
  const [showDomains, setShowDomains] = useState(false);
  const scoreFrameRef = useRef<number | null>(null);

  const planMutation = trpc.onboarding.generateStudyPlan.useMutation();

  const { readinessScore, domainScores } = diagnosticResults;
  const tier = scoreTierLabel(readinessScore);
  const hoursPerWeek = parseHoursPerWeek(selfAssessment.studyHours);

  // Build a local fallback plan immediately — this is what the button uses.
  // The AI mutation may upgrade it later, but the user is never blocked.
  const fallbackPlan = useRef(buildFallbackPlan(domainScores, hoursPerWeek));

  // The displayed plan: AI plan when ready, fallback otherwise.
  const plan = planMutation.data ?? fallbackPlan.current;
  const isAiEnhanced = Boolean(planMutation.data);
  const isGenerating = planMutation.isPending;

  // Animate score counter
  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * readinessScore));

      if (progress < 1) {
        scoreFrameRef.current = requestAnimationFrame(animate);
      } else {
        setScoreAnimDone(true);
        setTimeout(() => setShowDomains(true), 200);
      }
    };

    scoreFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (scoreFrameRef.current) cancelAnimationFrame(scoreFrameRef.current);
    };
  }, [readinessScore]);

  // Trigger AI plan generation on mount — upgrades the fallback if successful.
  // onPlanGenerated is called whenever we have a plan to pass up to the wizard.
  useEffect(() => {
    // Pass fallback plan up immediately so wizard state isn't empty
    onPlanGenerated(fallbackPlan.current);

    planMutation.mutate(
      {
        examId,
        domainScores,
        targetTimeframe: parseTargetTimeframe(selfAssessment.targetDate),
        hoursPerWeek,
      },
      {
        onSuccess: (aiPlan) => onPlanGenerated(aiPlan),
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SVG gauge
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const progressArc = (animatedScore / 100) * circumference;

  const domainEntries = Object.entries(domainScores);

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
        Step 4 of 5
      </p>

      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F1F1F5", margin: 0 }}>
        Your readiness snapshot
      </h1>

      {/* ── Circular gauge ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 32,
          marginBottom: 24,
        }}
      >
        <svg width={140} height={140} viewBox="0 0 140 140">
          {/* Track */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#2A2A38"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <motion.circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#00C97C"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progressArc}
            transform="rotate(-90 70 70)"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progressArc }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          {/* Center text */}
          <text
            x="70"
            y="66"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontSize: 36,
              fontWeight: 700,
              fill: "#F1F1F5",
              fontFamily: "var(--font-geist-sans)",
            }}
          >
            {animatedScore}
          </text>
          <text
            x="70"
            y="90"
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontSize: 16,
              fill: "#8B8BA7",
              fontFamily: "var(--font-geist-sans)",
            }}
          >
            / 100
          </text>
        </svg>

        {/* Pulse + tier */}
        {scoreAnimDone && (
          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              marginTop: 12,
              fontSize: 14,
              fontWeight: 600,
              color: tier.color,
            }}
          >
            {tier.text}
          </motion.p>
        )}
      </div>

      {/* ── Domain breakdown ── */}
      {showDomains && (
        <div style={{ marginBottom: 24 }}>
          {domainEntries.map(([domainId, score], i) => (
            <motion.div
              key={domainId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "#8B8BA7",
                  width: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {DOMAIN_LABELS[domainId] ?? domainId.slice(0, 8)}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: "#2A2A38",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    background: scoreColor(score),
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-geist-mono)",
                  color: scoreColor(score),
                  width: 36,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {score}%
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Study Plan ── */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>
            Your study plan
          </h2>
          {isGenerating && (
            <span style={{ fontSize: 11, color: "#52526B", display: "flex", alignItems: "center", gap: 4 }}>
              <span className="animate-pulse">✦</span> AI enhancing…
            </span>
          )}
          {isAiEnhanced && (
            <span style={{ fontSize: 11, color: "#00C97C" }}>✦ AI personalized</span>
          )}
        </div>

        {/* Plan is always available (fallback or AI) */}
        {plan && (
          <>
            <p style={{ fontSize: 14, color: "#8B8BA7", marginBottom: 16 }}>
              Ready to pass in ~{Math.ceil(plan.estimatedDaysToReadiness / 7)} weeks
            </p>

            {/* Horizontal scroll week cards */}
            <div
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                paddingBottom: 8,
                scrollSnapType: "x mandatory",
              }}
            >
              {plan.weeklyPlan.slice(0, 8).map((week) => (
                <div
                  key={week.weekNumber}
                  style={{
                    minWidth: 160,
                    background: "#13131A",
                    border: "1px solid #2A2A38",
                    borderRadius: 8,
                    padding: 14,
                    scrollSnapAlign: "start",
                    flexShrink: 0,
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#F1F1F5",
                      marginBottom: 8,
                    }}
                  >
                    Week {week.weekNumber}
                  </p>
                  {week.focusDomains.slice(0, 2).map((domain) => (
                    <span
                      key={domain}
                      style={{
                        display: "inline-block",
                        background: "rgba(0, 201, 124, 0.1)",
                        color: "#00C97C",
                        fontSize: 10,
                        borderRadius: 100,
                        padding: "2px 8px",
                        marginRight: 4,
                        marginBottom: 4,
                      }}
                    >
                      {domain}
                    </span>
                  ))}
                  <p
                    style={{
                      fontSize: 12,
                      color: "#8B8BA7",
                      marginTop: 8,
                      marginBottom: 0,
                    }}
                  >
                    {week.dailyMinutes} min/day
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Continue button — always enabled, plan is always ready (fallback or AI) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginTop: 32, marginBottom: 32 }}
      >
        <button
          onClick={onNext}
          style={{
            width: "100%",
            height: 52,
            background: "#00C97C",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#00B06C")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#00C97C")}
        >
          Let&apos;s set up your goals
          <ChevronRight size={18} />
        </button>
      </motion.div>
    </div>
  );
}
