"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Shield, Zap, Trophy, BookOpen, Target } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useAuthStore } from "@/store/auth";
import { SAA_C03_EXAM_ID, SAA_C03_DOMAIN_IDS } from "@/lib/constants";
import { getLevelTitle } from "@/lib/gamification/xp";
import Link from "next/link";

const DOMAIN_LABELS: Record<string, string> = {
  [SAA_C03_DOMAIN_IDS.RESILIENT]: "Design Resilient Architectures",
  [SAA_C03_DOMAIN_IDS.PERFORMANCE]: "Design High-Performing Architectures",
  [SAA_C03_DOMAIN_IDS.SECURITY]: "Design Secure Applications",
  [SAA_C03_DOMAIN_IDS.COST]: "Design Cost-Optimized Architectures",
  [SAA_C03_DOMAIN_IDS.OPERATIONS]: "Operationally Excellent Architectures",
  [SAA_C03_DOMAIN_IDS.IMPROVEMENT]: "Continuous Improvement",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = trpc.study.getDashboardData.useQuery();
  const { data: leaderboard } = trpc.leaderboard.getWeekly.useQuery({
    page: 1,
    pageSize: 5,
  });

  const firstName = useMemo(() => {
    const name = user?.user_metadata?.name as string | undefined;
    return name?.split(" ")[0] ?? "there";
  }, [user]);

  if (isLoading || !data) {
    return (
      <div style={{ padding: "32px 0" }}>
        <div style={{ height: 32, width: 240, background: "#13131A", borderRadius: 6, marginBottom: 8 }} className="animate-pulse" />
        <div style={{ height: 18, width: 160, background: "#13131A", borderRadius: 4 }} className="animate-pulse" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 100, background: "#13131A", borderRadius: 10, border: "1px solid #2A2A38" }} className="animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const p = data.profile;
  const streak = p?.currentStreak ?? 0;
  const shields = p?.streakShields ?? 0;
  const dailyGoal = p?.dailyGoalMinutes ?? 15;
  const goalProgress = Math.min(data.todayMinutes, dailyGoal);
  const goalComplete = goalProgress >= dailyGoal;
  const xp = p?.xp ?? 0;
  const level = p?.level ?? 1;
  const weakDomainName = data.weakestDomainId ? (DOMAIN_LABELS[data.weakestDomainId] ?? "Study") : "Study";

  // Streak icon sizing
  const streakSize = streak >= 60 ? 44 : streak >= 30 ? 40 : streak >= 7 ? 36 : 32;
  const streakColor = streak >= 60 ? "#EF4444" : streak >= 30 ? "#F97316" : "#F59E0B";
  const streakOpacity = streak < 7 ? 0.5 : 1;
  const streakGlow = streak >= 60 ? "drop-shadow(0 0 8px #EF444460)" : "none";

  // Studied today?
  const studiedToday = data.todayMinutes > 0;

  // Readiness gauge
  const readiness = data.readinessScore;
  const gaugeRadius = 52;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeProgress = (readiness / 100) * gaugeCircumference;

  return (
    <div style={{ padding: "24px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 24,
        }}
        className="dashboard-grid"
      >
        {/* ── Left Column ── */}
        <div>
          {/* Greeting */}
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>
            {getGreeting()}, {firstName}
          </h1>
          <p style={{ fontSize: 13, color: "#8B8BA7", marginTop: 4, marginBottom: 20 }}>
            {formatDate()}
          </p>

          {/* Streak Widget */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Flame
                  size={streakSize}
                  style={{ color: streakColor, opacity: streakOpacity, filter: streakGlow, flexShrink: 0 }}
                />
                <span style={{ fontSize: 20, fontWeight: 700, color: "#F1F1F5" }}>
                  {streak > 0 ? `${streak} day streak` : "Start your streak today"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: 3 }, (_, i) => (
                  <Shield
                    key={i}
                    size={20}
                    style={{ color: i < shields ? "#00C97C" : "#2A2A38" }}
                  />
                ))}
              </div>
            </div>
            {!studiedToday && streak > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                <Flame size={14} style={{ color: "#F59E0B" }} />
                <span style={{ fontSize: 12, color: "#F59E0B" }}>
                  Study today to keep your streak
                </span>
              </div>
            )}
          </div>

          {/* Daily Goal Progress */}
          <div style={{ ...cardStyle, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#8B8BA7" }}>Today&apos;s goal</span>
              <span style={{ fontSize: 13, fontFamily: "var(--font-geist-mono)", color: "#F1F1F5" }}>
                {goalComplete ? "✓ Complete" : `${goalProgress} / ${dailyGoal} min`}
              </span>
            </div>
            <div style={{ width: "100%", height: 8, background: "#2A2A38", borderRadius: 100, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((goalProgress / dailyGoal) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{
                  height: "100%",
                  borderRadius: 100,
                  background: goalComplete ? "#4ADE80" : "#00C97C",
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: "#52526B", marginTop: 8, marginBottom: 0 }}>
              {data.todayQuestions} questions answered today
            </p>
          </div>

          {/* Continue Studying CTA */}
          <div
            style={{
              marginTop: 12,
              background: "linear-gradient(135deg, rgba(0,201,124,0.03), #13131A)",
              border: "1px solid rgba(0,201,124,0.19)",
              borderRadius: 10,
              padding: "20px 24px",
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>
              Continue Studying
            </p>
            <p style={{ fontSize: 13, color: "#8B8BA7", marginTop: 4, marginBottom: 16 }}>
              {weakDomainName}
            </p>
            <Link href={data.weakestDomainId ? `/practice/quiz?domainId=${data.weakestDomainId}` : "/practice/quiz"}>
              <button
                style={ctaButtonStyle}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#00B06C")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#00C97C")}
              >
                Start Session →
              </button>
            </Link>
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <Link
                href="/study"
                style={{ fontSize: 12, color: "#8B8BA7", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Recalibrate My Plan
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginTop: 12,
            }}
            className="stats-grid"
          >
            <StatCard icon={<Zap size={16} style={{ color: "#00C97C" }} />} value={xp.toLocaleString()} label="Total XP" />
            <StatCard icon={<Target size={16} style={{ color: "#8B5CF6" }} />} value={`${level} · ${getLevelTitle(level)}`} label="Level" />
            <StatCard icon={<BookOpen size={16} style={{ color: "#22D3EE" }} />} value={data.domainProgress.reduce((s, d) => s + d.questionsAnswered, 0).toString()} label="Questions" />
            <StatCard icon={<Flame size={16} style={{ color: "#F59E0B" }} />} value={streak.toString()} label="Streak" />
          </div>
        </div>

        {/* ── Right Column ── */}
        <div>
          {/* Readiness Gauge */}
          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <svg width={120} height={120} viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={gaugeRadius} fill="none" stroke="#2A2A38" strokeWidth="6" />
                <motion.circle
                  cx="60" cy="60" r={gaugeRadius} fill="none"
                  stroke="#00C97C" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  initial={{ strokeDashoffset: gaugeCircumference }}
                  animate={{ strokeDashoffset: gaugeCircumference - gaugeProgress }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  transform="rotate(-90 60 60)"
                />
                <text x="60" y="56" textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 28, fontWeight: 700, fill: "#F1F1F5", fontFamily: "var(--font-geist-sans)" }}>
                  {readiness}
                </text>
                <text x="60" y="76" textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 12, fill: "#8B8BA7", fontFamily: "var(--font-geist-sans)" }}>
                  / 100
                </text>
              </svg>
              <p style={{ fontSize: 12, color: "#8B8BA7", marginTop: 8, marginBottom: 0 }}>
                Readiness Score
              </p>
            </div>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <Link href="/progress" style={{ fontSize: 12, color: "#00C97C", textDecoration: "none" }}>
                View Analytics →
              </Link>
            </div>
          </div>

          {/* Leaderboard Widget */}
          <div style={{ ...cardStyle, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#F1F1F5" }}>This Week</span>
              <Link href="/leaderboard" style={{ fontSize: 12, color: "#00C97C", textDecoration: "none" }}>
                View all →
              </Link>
            </div>
            {!leaderboard || leaderboard.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ height: 32, background: "#1C1C26", borderRadius: 4 }} className="animate-pulse" />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {leaderboard.slice(0, 5).map((entry) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div
                      key={entry.userId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 8px",
                        borderRadius: 4,
                        background: entry.isCurrentUser ? "rgba(0,201,124,0.063)" : "transparent",
                      }}
                    >
                      <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "#52526B", width: 24, textAlign: "center" }}>
                        {entry.rank <= 3 ? medals[entry.rank - 1] : entry.rank}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: "#F1F1F5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.name}
                      </span>
                      <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "#8B8BA7" }}>
                        {entry.xpEarned.toLocaleString()} XP
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div
      style={{
        background: "#13131A",
        border: "1px solid #2A2A38",
        borderRadius: 8,
        padding: 16,
        textAlign: "center",
      }}
    >
      <div style={{ marginBottom: 6 }}>{icon}</div>
      <p
        style={{
          fontSize: 20,
          fontFamily: "var(--font-geist-mono)",
          fontWeight: 700,
          color: "#F1F1F5",
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 11, color: "#52526B", margin: "4px 0 0 0" }}>{label}</p>
    </div>
  );
}

// ── Shared styles ────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "#13131A",
  border: "1px solid #2A2A38",
  borderRadius: 10,
  padding: "20px 24px",
};

const ctaButtonStyle: React.CSSProperties = {
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
};
