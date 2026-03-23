"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc/client";
import { SAA_C03_EXAM_ID } from "@/lib/constants";
import { getLevelTitle } from "@/lib/gamification/xp";

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function resetCountdown(): string {
  const now  = new Date();
  const secs = 59 - now.getUTCSeconds();
  return `${secs}s`;
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "#1C1C26", border: "1px solid #2A2A38",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 600, color: "#8B8BA7",
      fontFamily: "var(--font-geist-sans)", flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

function PodiumCard({
  rank, name, level, xp, isCurrentUser, height,
}: {
  rank: 1 | 2 | 3; name: string; level: number; xp: number; isCurrentUser: boolean; height: number;
}) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const borderColor = rank === 1 ? "rgba(245,158,11,0.4)" : "rgba(42,42,56,0.8)";
  const bg = rank === 1 ? "rgba(245,158,11,0.06)" : "transparent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      style={{
        height, border: `1px solid ${borderColor}`, background: bg,
        borderRadius: 10, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 16, gap: 6,
        flex: 1,
      }}
    >
      <span style={{ fontSize: 22 }}>{medals[rank]}</span>
      <Avatar name={name} size={40} />
      <p style={{ fontSize: 13, fontWeight: 600, color: isCurrentUser ? "#00C97C" : "#F1F1F5", margin: 0, textAlign: "center", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
      <p style={{ fontSize: 14, fontFamily: "var(--font-geist-mono)", color: "#00C97C", margin: 0 }}>{xp.toLocaleString()}</p>
    </motion.div>
  );
}

function LeaderboardRow({ entry, delay }: { entry: { userId: string; name: string; level: number; xpEarned: number; rank: number; isCurrentUser: boolean }; delay: number }) {
  const title = getLevelTitle(entry.level);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      style={{
        height: 56, padding: "0 16px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid #2A2A38",
        background: entry.isCurrentUser ? "rgba(0,201,124,0.04)" : "transparent",
        borderLeft: entry.isCurrentUser ? "2px solid #00C97C" : "2px solid transparent",
      }}
    >
      <span style={{ width: 24, textAlign: "right", fontSize: 13, fontFamily: "var(--font-geist-mono)", color: "#52526B", flexShrink: 0 }}>
        {entry.rank}
      </span>
      <Avatar name={entry.name} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, color: entry.isCurrentUser ? "#00C97C" : "#F1F1F5", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-geist-sans)" }}>
          {entry.name}
        </p>
        <p style={{ fontSize: 11, color: "#52526B", margin: 0, fontFamily: "var(--font-geist-sans)" }}>{title}</p>
      </div>
      <span style={{ fontSize: 14, fontFamily: "var(--font-geist-mono)", color: "#8B8BA7", flexShrink: 0 }}>
        {entry.xpEarned.toLocaleString()}
      </span>
    </motion.div>
  );
}

export default function LeaderboardPage() {
  const [examFilter, setExamFilter] = useState<"all" | "saa">("all");
  const [countdown, setCountdown]   = useState(resetCountdown);

  // Tick every second so the countdown stays current
  useEffect(() => {
    const id = setInterval(() => setCountdown(resetCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = trpc.leaderboard.getWeekly.useQuery(
    { examId: examFilter === "saa" ? SAA_C03_EXAM_ID : undefined, page: 1, pageSize: 50 },
    { refetchInterval: 60_000 },  // re-fetch every minute when period resets
  );

  const entries = data?.topList ?? [];
  const currentUserRow = data?.currentUserRow ?? null;

  // Separate top 3 for podium (desktop only)
  const top3 = entries.slice(0, 3);

  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = useMemo(() => {
    if (top3.length < 3) return top3;
    return [top3[1], top3[0], top3[2]];
  }, [top3]);

  const podiumHeights: Record<number, number> = { 0: 96, 1: 120, 2: 88 };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <h1 style={{ fontSize: 24, fontWeight: 600, color: "#F1F1F5", margin: 0, fontFamily: "var(--font-geist-sans)" }}>
        Leaderboard
      </h1>

      {/* Exam filter pills */}
      <div style={{ display: "inline-flex", background: "#13131A", border: "1px solid #2A2A38", borderRadius: 100, padding: 4, margin: "12px 0 20px" }}>
        {(["all", "saa"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setExamFilter(f)}
            style={{
              padding: "6px 16px", borderRadius: 100, border: "none",
              fontSize: 13, cursor: "pointer", fontFamily: "var(--font-geist-sans)",
              background: examFilter === f ? "#00C97C" : "transparent",
              color: examFilter === f ? "#0A0A0F" : "#52526B",
              fontWeight: examFilter === f ? 600 : 400,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {f === "all" ? "All Exams" : "SAA-C03"}
          </button>
        ))}
      </div>

      {/* Week label + reset countdown */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: "#52526B", fontFamily: "var(--font-geist-sans)" }}>
          This minute · Resets every minute
        </span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono)", color: "#52526B" }}>
          Resets in {countdown}
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{
              height: 56, background: "linear-gradient(90deg, #13131A 25%, #1C1C26 50%, #13131A 75%)",
              backgroundSize: "200% 100%", borderBottom: "1px solid #2A2A38",
              animation: "shimmer 1.5s infinite",
            }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#52526B", fontSize: 14, fontFamily: "var(--font-geist-sans)" }}>
          No study sessions this week yet. Be the first.
        </div>
      ) : (
        <>
          {/* Podium — desktop only */}
          {top3.length === 3 && (
            <div className="leaderboard-podium" style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "flex-end" }}>
              {podiumOrder.map((entry, i) => (
                <PodiumCard
                  key={entry.userId}
                  rank={(entry.rank) as 1 | 2 | 3}
                  name={entry.name}
                  level={entry.level}
                  xp={entry.xpEarned}
                  isCurrentUser={entry.isCurrentUser}
                  height={podiumHeights[i]}
                />
              ))}
            </div>
          )}

          {/* Full list */}
          <div style={{ border: "1px solid #2A2A38", borderRadius: 10, overflow: "hidden" }}>
            {entries.map((entry, i) => (
              <LeaderboardRow key={entry.userId} entry={entry} delay={i * 0.03} />
            ))}

            {/* Current user pinned if outside top 50 */}
            {currentUserRow && (
              <>
                <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 16, color: "#52526B", letterSpacing: 4 }}>···</span>
                </div>
                <LeaderboardRow entry={currentUserRow} delay={0} />
              </>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @media (max-width: 640px) { .leaderboard-podium { display: none !important; } }
      `}</style>
    </div>
  );
}
