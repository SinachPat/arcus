"use client";

import { use } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import Link from "next/link";

function masteryColor(mastery: number): string {
  if (mastery >= 90) return "#4ADE80";
  if (mastery >= 70) return "#00C97C";
  if (mastery >= 40) return "#F59E0B";
  return "#EF4444";
}

export default function DomainDetailPage({
  params,
}: {
  params: Promise<{ domainId: string }>;
}) {
  const { domainId } = use(params);
  const { data: domain, isLoading } = trpc.study.getDomainDetail.useQuery({ domainId });

  if (isLoading || !domain) {
    return (
      <div style={{ padding: "24px 0" }}>
        <div style={{ height: 18, width: 100, background: "#13131A", borderRadius: 4, marginBottom: 20 }} className="animate-pulse" />
        <div style={{ height: 32, width: 300, background: "#13131A", borderRadius: 6, marginBottom: 12 }} className="animate-pulse" />
        <div style={{ height: 10, background: "#13131A", borderRadius: 100, marginBottom: 12 }} className="animate-pulse" />
        <div style={{ height: 16, width: 280, background: "#13131A", borderRadius: 4 }} className="animate-pulse" />
      </div>
    );
  }

  const color = masteryColor(domain.mastery);

  // Determine which subtopics are unlocked
  const masteredSubtopicIds = new Set(
    domain.subtopics
      .filter((s) => s.mastery >= 70)
      .map((s) => s.id)
  );

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Back link */}
      <Link
        href="/study"
        style={{ fontSize: 13, color: "#8B8BA7", textDecoration: "none", display: "inline-block", marginBottom: 20 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#F1F1F5")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#8B8BA7")}
      >
        ← Study Hub
      </Link>

      {/* Domain Header */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#F1F1F5", margin: 0, marginBottom: 16 }}>
        {domain.name}
      </h1>

      {/* Mastery bar */}
      <div style={{ width: "100%", height: 10, background: "#2A2A38", borderRadius: 100, overflow: "hidden", marginBottom: 12 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${domain.mastery}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 100, background: color }}
        />
      </div>

      {/* Stats row */}
      <p style={{ fontSize: 13, color: "#8B8BA7", margin: 0 }}>
        Mastery: <span style={{ color }}>{domain.mastery}%</span>
        {" · "}
        {domain.questionsAnswered} / {domain.totalQuestions} questions answered
        {" · "}
        Difficulty: {domain.currentDifficulty}/5
      </p>

      {/* CTA Row */}
      <div className="domain-cta-row" style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Link href={`/practice/quiz?domainId=${domainId}`} style={{ flex: 1, textDecoration: "none" }}>
          <button
            style={{
              width: "100%",
              height: 44,
              background: "#00C97C",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#00B06C")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#00C97C")}
          >
            Practice This Domain
          </button>
        </Link>
        <Link href={`/tutor?domainId=${domainId}`} style={{ flex: 1, textDecoration: "none" }}>
          <button
            style={{
              width: "100%",
              height: 44,
              background: "transparent",
              border: "1px solid #2A2A38",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              color: "#F1F1F5",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#3D3D52";
              e.currentTarget.style.background = "#1C1C26";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#2A2A38";
              e.currentTarget.style.background = "transparent";
            }}
          >
            Ask AI Tutor
          </button>
        </Link>
      </div>

      {/* Subtopics */}
      {domain.subtopics.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F5", marginBottom: 12 }}>
            Subtopics
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {domain.subtopics.map((subtopic, i) => {
              const isLocked = subtopic.prerequisiteSubtopicId
                ? !masteredSubtopicIds.has(subtopic.prerequisiteSubtopicId)
                : false;
              const stColor = masteryColor(subtopic.mastery);

              return (
                <motion.div
                  key={subtopic.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    opacity: isLocked ? 0.4 : 1,
                  }}
                  title={isLocked ? "Complete prerequisite subtopic first" : undefined}
                >
                  {/* Color dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: isLocked ? "#2A2A38" : stColor,
                      flexShrink: 0,
                    }}
                  />

                  {/* Name */}
                  <span style={{ fontSize: 14, color: "#F1F1F5", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {subtopic.name}
                    {isLocked && <Lock size={12} style={{ marginLeft: 6, verticalAlign: "middle", color: "#52526B" }} />}
                  </span>

                  {/* Progress bar */}
                  <div style={{ flex: 1, height: 4, background: "#2A2A38", borderRadius: 2, margin: "0 16px", overflow: "hidden" }}>
                    <div style={{ width: `${subtopic.mastery}%`, height: "100%", borderRadius: 2, background: isLocked ? "#2A2A38" : stColor, transition: "width 0.5s ease" }} />
                  </div>

                  {/* Percentage */}
                  <span style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", color: "#8B8BA7", flexShrink: 0 }}>
                    {subtopic.mastery}%
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 640px) {
          .domain-cta-row { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}
