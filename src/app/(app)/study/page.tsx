"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { SAA_C03_EXAM_ID } from "@/lib/constants";
import Link from "next/link";

function masteryColor(mastery: number): { bg: string; border: string; text: string } {
  if (mastery >= 90) return { bg: "#4ADE8020", border: "#4ADE8040", text: "#4ADE80" };
  if (mastery >= 70) return { bg: "#00C97C20", border: "#00C97C40", text: "#00C97C" };
  if (mastery >= 40) return { bg: "#F59E0B20", border: "#F59E0B40", text: "#F59E0B" };
  return { bg: "#EF444420", border: "#EF444440", text: "#EF4444" };
}

const DOMAIN_ABBREVS: Record<string, string> = {
  "Design Resilient Architectures": "RES",
  "Design High-Performing Architectures": "PERF",
  "Design Secure Applications": "SEC",
  "Design Cost-Optimized Architectures": "COST",
  "Operationally Excellent Architectures": "OPS",
  "Continuous Improvement for Existing Solutions": "IMP",
};

function abbreviate(name: string): string {
  return DOMAIN_ABBREVS[name] ?? name.slice(0, 4).toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── SVG Skill Tree ───────────────────────────────────────────────────────────
// viewBox: 600 × 280. Layout:
//   Root node  : cx=300 cy=44  r=24
//   Row 1 nodes: cy=148, cx at [110, 300, 490], r=28
//   Row 2 nodes: cy=248, cx at [110, 300, 490], r=28
// Lines drawn with cubic beziers for a smooth tree look.

const ROW1_CX = [110, 300, 490] as const;
const ROW2_CX = [110, 300, 490] as const;
const ROOT = { cx: 300, cy: 44, r: 24 };
const R1_CY = 148;
const R2_CY = 248;
const NODE_R = 28;

type SkillDomain = {
  id: string;
  name: string;
  mastery: number;
  displayOrder: number;
};

function SkillTree({ domains }: { domains: SkillDomain[] }) {
  const router = useRouter();
  const row1 = domains.slice(0, 3);
  const row2 = domains.slice(3, 6);

  // Bezier path from (x1,y1) to (x2,y2) with vertical control points
  function bezierPath(x1: number, y1: number, x2: number, y2: number) {
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }

  return (
    <div className="study-skill-tree" style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F5", marginBottom: 16 }}>
        Skill Tree
      </h2>

      <svg
        viewBox="0 0 600 280"
        width="100%"
        style={{ height: "auto", maxHeight: 280, display: "block" }}
        preserveAspectRatio="xMidYMid meet"
        aria-label="SAA-C03 skill tree"
      >
        {/* ── SVG Glow filter for mastered nodes ── */}
        <defs>
          <filter id="glow-green" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feFlood floodColor="#4ADE80" floodOpacity="0.5" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-teal" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feFlood floodColor="#00C97C" floodOpacity="0.45" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── Connecting lines: Root → Row 1 ── */}
        {ROW1_CX.map((cx, i) => (
          <motion.path
            key={`r-r1-${i}`}
            d={bezierPath(ROOT.cx, ROOT.cy + ROOT.r, cx, R1_CY - NODE_R)}
            stroke="#2A2A38"
            strokeWidth={1.5}
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: "easeOut" }}
          />
        ))}

        {/* ── Connecting lines: Row 1 → Row 2 ── */}
        {ROW1_CX.map((cx, i) => (
          <motion.path
            key={`r1-r2-${i}`}
            d={bezierPath(cx, R1_CY + NODE_R, ROW2_CX[i], R2_CY - NODE_R)}
            stroke="#2A2A38"
            strokeWidth={1.5}
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.08, ease: "easeOut" }}
          />
        ))}

        {/* ── Root node: SAA-C03 ── */}
        <motion.g
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0 }}
          style={{ transformOrigin: `${ROOT.cx}px ${ROOT.cy}px` }}
        >
          <circle
            cx={ROOT.cx} cy={ROOT.cy} r={ROOT.r}
            fill="#1A1A28"
            stroke="#00C97C"
            strokeWidth={2}
          />
          <text
            x={ROOT.cx} y={ROOT.cy + 1}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fontWeight={700} fill="#00C97C"
            fontFamily="var(--font-geist-mono)"
          >
            SAA-C03
          </text>
        </motion.g>

        {/* ── Row 1 domain nodes ── */}
        {row1.map((domain, i) => {
          const cx = ROW1_CX[i];
          const colors = masteryColor(domain.mastery);
          const isGlowing = domain.mastery >= 90;
          const filterId = domain.mastery >= 90 ? "glow-green" : domain.mastery >= 70 ? "glow-teal" : undefined;

          return (
            <motion.g
              key={domain.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 + i * 0.08 }}
              style={{ cursor: "pointer", transformOrigin: `${cx}px ${R1_CY}px` }}
              onClick={() => router.push(`/study/${domain.id}`)}
              whileHover={{ scale: 1.08 } as never}
              filter={filterId ? `url(#${filterId})` : undefined}
              tabIndex={0}
              aria-label={`${domain.name} — ${domain.mastery}% mastery`}
            >
              <circle
                cx={cx} cy={R1_CY} r={NODE_R}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={isGlowing ? 2.5 : 2}
              />
              <text
                x={cx} y={R1_CY - 5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fontWeight={700} fill={colors.text}
                fontFamily="var(--font-geist-mono)"
              >
                {abbreviate(domain.name)}
              </text>
              <text
                x={cx} y={R1_CY + 10}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fontWeight={400} fill={colors.text}
                opacity={0.75}
                fontFamily="var(--font-geist-mono)"
              >
                {domain.mastery}%
              </text>
            </motion.g>
          );
        })}

        {/* ── Row 2 domain nodes ── */}
        {row2.map((domain, i) => {
          const cx = ROW2_CX[i];
          const colors = masteryColor(domain.mastery);
          const isGlowing = domain.mastery >= 90;
          const filterId = domain.mastery >= 90 ? "glow-green" : domain.mastery >= 70 ? "glow-teal" : undefined;

          return (
            <motion.g
              key={domain.id}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.38 + i * 0.08 }}
              style={{ cursor: "pointer", transformOrigin: `${cx}px ${R2_CY}px` }}
              onClick={() => router.push(`/study/${domain.id}`)}
              whileHover={{ scale: 1.08 } as never}
              filter={filterId ? `url(#${filterId})` : undefined}
              tabIndex={0}
              aria-label={`${domain.name} — ${domain.mastery}% mastery`}
            >
              <circle
                cx={cx} cy={R2_CY} r={NODE_R}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={isGlowing ? 2.5 : 2}
              />
              <text
                x={cx} y={R2_CY - 5}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fontWeight={700} fill={colors.text}
                fontFamily="var(--font-geist-mono)"
              >
                {abbreviate(domain.name)}
              </text>
              <text
                x={cx} y={R2_CY + 10}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fontWeight={400} fill={colors.text}
                opacity={0.75}
                fontFamily="var(--font-geist-mono)"
              >
                {domain.mastery}%
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

export default function StudyPage() {
  const { data: domains, isLoading } = trpc.study.getSkillTree.useQuery({
    examId: SAA_C03_EXAM_ID,
  });

  return (
    <div style={{ padding: "0" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: "#F1F1F5", marginBottom: 24 }}>
        Study
      </h1>

      {/* Domain Progress List */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ height: 100, background: "#13131A", borderRadius: 10, border: "1px solid #2A2A38" }} className="animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(domains ?? []).map((domain, i) => {
              const colors = masteryColor(domain.mastery);
              return (
                <motion.div
                  key={domain.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/study/${domain.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className="study-domain-card"
                      style={{
                        background: "#13131A",
                        border: "1px solid #2A2A38",
                        borderRadius: 10,
                        padding: 20,
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D3D52")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A38")}
                    >
                      {/* Number square */}
                      <div
                        className="domain-number"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 8,
                          background: colors.bg,
                          border: `1px solid ${colors.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: 18, fontFamily: "var(--font-geist-mono)", fontWeight: 600, color: colors.text }}>
                          {domain.displayOrder}
                        </span>
                      </div>

                      {/* Center: name + bar + stats */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#F1F1F5", margin: 0, marginBottom: 8 }}>
                          {domain.name}
                        </p>
                        <div style={{ width: "100%", height: 6, background: "#2A2A38", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                          <div style={{ width: `${domain.mastery}%`, height: "100%", borderRadius: 3, background: colors.text, transition: "width 0.5s ease" }} />
                        </div>
                        <p className="domain-stats" style={{ fontSize: 12, color: "#52526B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {domain.questionsAnswered}q answered · {formatDate(domain.lastPracticed)}
                        </p>
                      </div>

                      {/* Right: mastery % + practice link */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p className="domain-mastery" style={{ fontSize: 20, fontFamily: "var(--font-geist-mono)", fontWeight: 700, color: colors.text, margin: 0 }}>
                          {domain.mastery}%
                        </p>
                        <span style={{ fontSize: 13, color: "#00C97C" }}>Practice →</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Skill Tree Visualization */}
          {domains && domains.length > 0 && (
            <SkillTree domains={domains} />
          )}
        </>
      )}
      <style>{`
        @media (max-width: 640px) {
          .study-domain-card { padding: 14px !important; gap: 10px !important; }
          .study-domain-card .domain-number { width: 36px !important; height: 36px !important; flex-shrink: 0 !important; }
          .study-domain-card .domain-number span { font-size: 14px !important; }
          .study-domain-card .domain-mastery { font-size: 15px !important; }
          .study-domain-card .domain-stats { font-size: 11px !important; }
          .study-skill-tree svg { max-height: 200px !important; }
        }
      `}</style>
    </div>
  );
}
