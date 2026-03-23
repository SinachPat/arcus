"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { SAA_C03_EXAM_ID, ROUTES } from "@/lib/constants";

// ── design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:      "#0A0A0F",
  surface: "#13131A",
  border:  "#2A2A38",
  border2: "#3D3D52",
  accent:  "#00C97C",
  success: "#4ADE80",
  warn:    "#F59E0B",
  danger:  "#EF4444",
  text:    "#F1F1F5",
  muted:   "#8B8BA7",
  dim:     "#52526B",
  overlay: "#1C1C26",
} as const;

const FONT_MONO = "var(--font-geist-mono)";
const FONT_SANS = "var(--font-geist-sans)";

// ── domain helpers ─────────────────────────────────────────────────────────
function codeAbbr(code: string): string {
  const map: Record<string, string> = {
    RESILIENT:   "RES",
    PERFORMANCE: "PERF",
    SECURITY:    "SEC",
    COST:        "COST",
    OPERATIONS:  "OPS",
    IMPROVEMENT: "IMP",
  };
  return map[code] ?? code.slice(0, 4);
}

function accuracyColor(pct: number): string {
  if (pct >= 72) return C.accent;
  if (pct >= 50) return C.warn;
  return C.danger;
}

// ── SVG utilities ──────────────────────────────────────────────────────────
function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0  = pts[i - 1];
    const p1  = pts[i];
    const cpx = (p0.x + p1.x) / 2;
    d += ` C ${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}

// ── card wrapper ────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background:   C.surface,
        border:       `1px solid ${C.border}`,
        borderRadius: 10,
        padding:      20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT_SANS }}>{left}</span>
      {right && <span style={{ fontSize: 12, color: C.dim, fontFamily: FONT_SANS }}>{right}</span>}
    </div>
  );
}

function Skeleton({ h, w = "100%", r = 6 }: { h: number; w?: string | number; r?: number }) {
  return (
    <div style={{ height: h, width: w, borderRadius: r, background: C.border, animation: "pulse 1.6s ease-in-out infinite" }} />
  );
}

// ── ReadinessCard ──────────────────────────────────────────────────────────
function ReadinessCard({
  trend, currentScore, deltaThisWeek, loading,
}: {
  trend:         { date: string; score: number }[];
  currentScore:  number;
  deltaThisWeek: number;
  loading:       boolean;
}) {
  const pathRef       = useRef<SVGPathElement>(null);
  const [len, setLen]     = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  const VW = 600, VH = 200;
  const PAD = { top: 16, right: 72, bottom: 32, left: 38 };
  const IW  = VW - PAD.left - PAD.right;
  const IH  = VH - PAD.top  - PAD.bottom;
  const scoreToY = (s: number) => PAD.top + (1 - s / 100) * IH;

  const pts = (() => {
    if (trend.length === 0) return [];
    const startMs = new Date(trend[0].date + "T00:00:00").getTime();
    const endMs   = new Date(trend[trend.length - 1].date + "T00:00:00").getTime();
    const spanMs  = endMs - startMs || 1;
    return trend.map((d) => ({
      x: PAD.left + ((new Date(d.date + "T00:00:00").getTime() - startMs) / spanMs) * IW,
      y: scoreToY(d.score),
      date: d.date,
      score: d.score,
    }));
  })();

  const path = smoothLine(pts.map(({ x, y }) => ({ x, y })));

  useEffect(() => {
    if (!pathRef.current || !path) return;
    const l = pathRef.current.getTotalLength();
    setLen(l);
    const id = setTimeout(() => setDrawn(true), 80);
    return () => clearTimeout(id);
  }, [path]);

  const gridScores = [0, 25, 50, 72, 100];

  const xTicks = (() => {
    if (trend.length < 2) return [];
    const startMs = new Date(trend[0].date + "T00:00:00").getTime();
    const spanMs  = new Date(trend[trend.length - 1].date + "T00:00:00").getTime() - startMs || 1;
    return trend
      .filter((_, i) => i % 7 === 0)
      .map((d) => ({
        label: formatDateLabel(d.date),
        x:     PAD.left + ((new Date(d.date + "T00:00:00").getTime() - startMs) / spanMs) * IW,
      }));
  })();

  if (loading) {
    return (
      <Card>
        <CardHeader left="Readiness Score" />
        <Skeleton h={160} />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        left="Readiness Score"
        right={
          <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontFamily: FONT_MONO }}>{currentScore}</span>
            <span style={{ fontSize: 13, color: C.dim, fontFamily: FONT_MONO }}>/100</span>
          </span>
        }
      />

      {trend.length === 0 ? (
        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontSize: 13, fontFamily: FONT_SANS }}>
          Start studying to see your readiness trend
        </div>
      ) : (
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: 160, overflow: "visible" }}>
          {/* Gridlines */}
          {gridScores.map((s) => {
            const y      = scoreToY(s);
            const isPass = s === 72;
            return (
              <g key={s}>
                <line x1={PAD.left} x2={VW - PAD.right} y1={y} y2={y}
                  stroke={isPass ? `${C.warn}30` : C.border} strokeWidth={1}
                  strokeDasharray={isPass ? "4 4" : undefined} />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill={C.dim} fontSize={10} fontFamily={FONT_MONO}>{s}</text>
                {isPass && (
                  <text x={VW - PAD.right + 4} y={y + 4} fill={C.dim} fontSize={10} fontFamily={FONT_SANS}>Pass</text>
                )}
              </g>
            );
          })}

          {/* X axis ticks */}
          {xTicks.map((t, i) => (
            <text key={i} x={t.x} y={VH - PAD.bottom + 14} textAnchor="middle" fill={C.dim} fontSize={10} fontFamily={FONT_SANS}>
              {t.label}
            </text>
          ))}

          {/* Animated line */}
          <path ref={pathRef} d={path} stroke={C.accent} strokeWidth={2} fill="none"
            style={{
              strokeDasharray:  len || 2000,
              strokeDashoffset: drawn ? 0 : (len || 2000),
              transition:       "stroke-dashoffset 1.2s ease",
            }}
          />

          {/* Data points */}
          {pts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={hovered === i ? 6 : 4} fill={C.accent}
              style={{ cursor: "crosshair", transition: "r 0.1s" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {/* Tooltip */}
          {hovered !== null && pts[hovered] && (
            <g>
              <rect
                x={Math.min(pts[hovered].x - 38, VW - PAD.right - 76)} y={pts[hovered].y - 42}
                width={76} height={32} rx={4} fill={C.overlay} stroke={C.border}
              />
              <text x={Math.min(pts[hovered].x, VW - PAD.right - 38)} y={pts[hovered].y - 25}
                textAnchor="middle" fill={C.text} fontSize={12} fontFamily={FONT_MONO} fontWeight={700}>
                {pts[hovered].score}/100
              </text>
              <text x={Math.min(pts[hovered].x, VW - PAD.right - 38)} y={pts[hovered].y - 13}
                textAnchor="middle" fill={C.dim} fontSize={10} fontFamily={FONT_SANS}>
                {formatDateLabel(pts[hovered].date)}
              </text>
            </g>
          )}
        </svg>
      )}

      {trend.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, fontFamily: FONT_MONO, color: deltaThisWeek >= 0 ? C.accent : C.danger }}>
          {deltaThisWeek >= 0 ? "↑" : "↓"} {deltaThisWeek >= 0 ? "+" : ""}{deltaThisWeek} this week
        </div>
      )}
    </Card>
  );
}

// ── StudyTimeCard ──────────────────────────────────────────────────────────
function StudyTimeCard({
  daily, weeklyAvgMinutes, loading,
}: {
  daily:            { date: string; minutes: number }[];
  weeklyAvgMinutes: number;
  loading:          boolean;
}) {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered]   = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(id);
  }, []);

  const VW = 600, VH = 150;
  const PAD = { top: 10, right: 10, bottom: 28, left: 38 };
  const IW  = VW - PAD.left - PAD.right;
  const IH  = VH - PAD.top  - PAD.bottom;
  const n   = daily.length || 14;

  const maxRaw  = Math.max(...daily.map((d) => d.minutes), 1);
  const maxMins = Math.ceil(maxRaw / 30) * 30 || 30;
  const barW    = Math.max(8, (IW - (n - 1) * 4) / n);
  const gap     = n > 1 ? (IW - n * barW) / (n - 1) : 0;

  if (loading) {
    return (
      <Card style={{ marginTop: 16 }}>
        <CardHeader left="Study Time" right="Last 14 days" />
        <Skeleton h={120} />
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <CardHeader left="Study Time" right="Last 14 days" />
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", height: 120, overflow: "visible" }}>
        <text x={PAD.left - 6} y={PAD.top + 4}      textAnchor="end" fill={C.dim} fontSize={10} fontFamily={FONT_MONO}>{maxMins}m</text>
        <text x={PAD.left - 6} y={PAD.top + IH + 4} textAnchor="end" fill={C.dim} fontSize={10} fontFamily={FONT_MONO}>0</text>

        {daily.map((d, i) => {
          const rawH  = Math.max((d.minutes / maxMins) * IH, 4);
          const barX  = PAD.left + i * (barW + gap);
          const baseY = PAD.top + IH;
          const isHov = hovered === i;

          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{
                transformOrigin: `${barX + barW / 2}px ${baseY}px`,
                transform:       `scaleY(${animated ? 1 : 0})`,
                transition:      `transform 0.4s ease ${i * 0.03}s`,
              }}>
              <rect x={barX} y={baseY - rawH} width={barW} height={rawH} rx={3}
                fill={isHov ? `${C.accent}B3` : `${C.accent}66`} style={{ cursor: "default" }} />
            </g>
          );
        })}

        {daily.map((d, i) => {
          if (i % 3 !== 0) return null;
          const barX = PAD.left + i * (barW + gap);
          return (
            <text key={i} x={barX + barW / 2} y={VH - PAD.bottom + 14}
              textAnchor="middle" fill={C.dim} fontSize={9} fontFamily={FONT_SANS}>
              {formatDayLabel(d.date)}
            </text>
          );
        })}

        {hovered !== null && daily[hovered] && (() => {
          const barX = PAD.left + hovered * (barW + gap);
          const rawH = Math.max((daily[hovered].minutes / maxMins) * IH, 4);
          const tipX = Math.min(barX + barW / 2, VW - PAD.right - 50);
          const tipY = Math.max(PAD.top + IH - rawH - 36, PAD.top);
          return (
            <g>
              <rect x={tipX - 42} y={tipY} width={84} height={28} rx={4} fill={C.overlay} stroke={C.border} />
              <text x={tipX} y={tipY + 12} textAnchor="middle" fill={C.text}  fontSize={11} fontFamily={FONT_MONO} fontWeight={700}>{daily[hovered].minutes}m</text>
              <text x={tipX} y={tipY + 24} textAnchor="middle" fill={C.dim}   fontSize={9}  fontFamily={FONT_SANS}>{formatDateLabel(daily[hovered].date)}</text>
            </g>
          );
        })()}
      </svg>
      <div style={{ marginTop: 8, fontSize: 12, color: C.muted, fontFamily: FONT_SANS }}>
        Weekly average: {weeklyAvgMinutes} min/day
      </div>
    </Card>
  );
}

// ── AccuracyTrendsCard ─────────────────────────────────────────────────────
function AccuracyTrendsCard({
  trends, loading,
}: {
  trends: {
    domainId:        string;
    code:            string;
    name:            string;
    currentAccuracy: number;
    deltaPercent:    number;
    sparkline:       { date: string; accuracy: number }[];
  }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card style={{ marginTop: 16 }}>
        <CardHeader left="7-Day Accuracy by Domain" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={28} />)}
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <CardHeader left="7-Day Accuracy by Domain" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {trends.map((t, idx) => {
          const col    = accuracyColor(t.currentAccuracy);
          const delCol = t.deltaPercent >= 0 ? C.accent : C.danger;
          const nonZero = t.sparkline.filter((s) => s.accuracy > 0);
          const sparkPath = (() => {
            if (nonZero.length < 2) return null;
            const maxAcc = Math.max(...nonZero.map((s) => s.accuracy), 1);
            return smoothLine(
              nonZero.map((s, i) => ({
                x: (i / (nonZero.length - 1)) * 78 + 1,
                y: 19 - (s.accuracy / maxAcc) * 17,
              }))
            );
          })();

          return (
            <div key={t.domainId}
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          10,
                height:       36,
                borderBottom: idx < trends.length - 1 ? `1px solid ${C.border}` : "none",
              }}>
              <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: C.dim, width: 40, flexShrink: 0 }}>
                {codeAbbr(t.code)}
              </span>
              <svg width={80} height={20} style={{ flexShrink: 0 }}>
                {sparkPath
                  ? <path d={sparkPath} stroke={C.accent} strokeWidth={1.5} fill="none" />
                  : <line x1={1} y1={10} x2={79} y2={10} stroke={C.border} strokeWidth={1} />}
              </svg>
              <span style={{ fontSize: 13, fontFamily: FONT_MONO, color: col, marginLeft: "auto", minWidth: 36, textAlign: "right" }}>
                {t.currentAccuracy}%
              </span>
              <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: delCol, minWidth: 48, textAlign: "right" }}>
                {t.deltaPercent >= 0 ? "↑ +" : "↓ "}{t.deltaPercent}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── DomainHeatmap ──────────────────────────────────────────────────────────
function DomainHeatmap({
  domains, loading,
}: {
  domains: {
    domain_id:       string;
    mastery_percent: number;
    domains: { name: string; code: string; display_order: number } | null;
  }[];
  loading: boolean;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);

  function cellStyle(mastery: number, isHov: boolean): React.CSSProperties {
    let bg: string = C.border, border: string = `1px solid ${C.border2}`, shadow: string = "none";
    if      (mastery >= 90) { bg = `${C.accent}25`; border = `1px solid ${C.accent}`;    shadow = `0 0 12px ${C.accent}20`; }
    else if (mastery >= 70) { bg = `${C.accent}15`; border = `1px solid ${C.accent}30`; }
    else if (mastery >= 40) { bg = `${C.warn}15`;   border = `1px solid ${C.warn}30`;   }
    else if (mastery >= 1)  { bg = `${C.danger}15`; border = `1px solid ${C.danger}30`; }
    return {
      background: bg, border, boxShadow: shadow, borderRadius: 8, padding: 14,
      aspectRatio: "1 / 1", cursor: "pointer", display: "flex", flexDirection: "column",
      justifyContent: "space-between",
      transform: isHov ? "scale(1.03)" : "scale(1)",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
    };
  }

  const sorted = [...domains].sort(
    (a, b) => (a.domains?.display_order ?? 99) - (b.domains?.display_order ?? 99)
  );

  if (loading) {
    return (
      <Card>
        <CardHeader left="Domain Mastery" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: "1/1", borderRadius: 8, background: C.border }} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader left="Domain Mastery" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {sorted.map((d, i) => {
          const mastery = d.mastery_percent;
          const isHov   = hover === d.domain_id;
          return (
            <div key={d.domain_id}
              style={{ ...cellStyle(mastery, isHov), animation: `fadeScaleIn 0.3s ease ${i * 0.05}s both` }}
              onMouseEnter={() => setHover(d.domain_id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push(ROUTES.studyDomain(d.domain_id))}
              title={d.domains?.name ?? ""}>
              <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: C.dim }}>
                {d.domains?.code ? codeAbbr(d.domains.code) : "—"}
              </span>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: FONT_MONO, color: accuracyColor(mastery), textAlign: "center", lineHeight: 1 }}>
                {mastery}%
              </span>
              <span style={{ fontSize: 10, color: C.dim, fontFamily: FONT_SANS }}>Mastery</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── QuickStats ─────────────────────────────────────────────────────────────
function QuickStats({
  totalQuestions, totalSessions, bestStreak, mockExamCount, loading,
}: {
  totalQuestions: number;
  totalSessions:  number;
  bestStreak:     number;
  mockExamCount:  number;
  loading:        boolean;
}) {
  const stats = [
    { label: "Questions",   value: totalQuestions.toLocaleString() },
    { label: "Sessions",    value: totalSessions.toLocaleString()  },
    { label: "Best Streak", value: `${bestStreak}d`                },
    { label: "Mock Exams",  value: mockExamCount.toLocaleString()  },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, textAlign: "center" }}>
          {loading
            ? <Skeleton h={28} w="60%" />
            : <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FONT_MONO, color: C.text }}>{s.value}</div>}
          <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT_SANS, marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── PredictedPassCard ──────────────────────────────────────────────────────
type PassResult =
  | { eligible: true;  estimatedDateRange: { earliest: string; latest: string }; confidenceLevel: "low" | "medium" | "high"; confidenceReason: string }
  | { eligible: false; reason: "not_premium" | "insufficient_data" | "no_mock_exam" | "ai_error" };

function PredictedPassCard({
  result, subscriptionTier, loading,
}: {
  result?:          PassResult;
  subscriptionTier: "free" | "pro" | "premium";
  loading:          boolean;
}) {
  const router  = useRouter();
  const isLocked = subscriptionTier !== "premium";

  if (loading) {
    return <Card style={{ marginTop: 16 }}><Skeleton h={140} /></Card>;
  }

  if (isLocked) {
    return (
      <Card style={{ marginTop: 16, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
        <div style={{ filter: "blur(4px)", pointerEvents: "none", userSelect: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CalendarCheck size={16} color={C.accent} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT_SANS }}>Predicted Pass Date</span>
          </div>
          <div style={{ fontSize: 28, fontFamily: FONT_MONO, fontWeight: 700, color: C.text }}>Jun 12 – 19</div>
          <div style={{ marginTop: 10, display: "flex", gap: 4 }}>
            {[1,2,3].map((n) => <div key={n} style={{ width: 24, height: 6, borderRadius: 3, background: n <= 2 ? C.warn : C.border }} />)}
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: `${C.surface}CC`, backdropFilter: "blur(2px)" }}>
          <Lock size={20} color={C.dim} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT_SANS }}>Predicted Pass Date</span>
          <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT_SANS }}>Available on Premium</span>
          <button
            onClick={() => router.push("/profile")}
            style={{ marginTop: 4, height: 36, border: `1px solid ${C.accent}`, borderRadius: 6, padding: "0 16px", fontSize: 12, color: C.accent, background: "transparent", cursor: "pointer", fontFamily: FONT_SANS }}>
            Upgrade →
          </button>
        </div>
      </Card>
    );
  }

  if (!result || !result.eligible) {
    const msg = result?.reason === "no_mock_exam"
      ? "Complete a mock exam to unlock pass date prediction"
      : "Study for 7+ days to unlock pass date prediction";
    return (
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <CalendarCheck size={16} color={C.accent} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT_SANS }}>Predicted Pass Date</span>
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontFamily: FONT_SANS }}>{msg}</div>
      </Card>
    );
  }

  const { estimatedDateRange, confidenceLevel } = result;
  const confColor = confidenceLevel === "high" ? C.accent : C.warn;
  const confFill  = confidenceLevel === "high" ? 3 : confidenceLevel === "medium" ? 2 : 1;
  const confLabel = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" }[confidenceLevel];

  return (
    <Card style={{ marginTop: 16, border: `1px solid ${C.accent}30` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CalendarCheck size={16} color={C.accent} />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: FONT_SANS }}>Predicted Pass Date</span>
      </div>
      <div style={{ fontSize: 28, fontFamily: FONT_MONO, fontWeight: 700, color: C.text, marginTop: 12 }}>
        {formatDateLabel(estimatedDateRange.earliest)} – {formatDateLabel(estimatedDateRange.latest)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[1,2,3].map((n) => (
            <div key={n} style={{ width: 24, height: 6, borderRadius: 3, background: n <= confFill ? confColor : C.border }} />
          ))}
        </div>
        <span style={{ fontSize: 11, color: confColor, fontFamily: FONT_SANS }}>{confLabel}</span>
      </div>
      <div style={{ marginTop: 12, background: C.overlay, borderRadius: 6, padding: "10px 12px", fontSize: 11, color: C.dim, lineHeight: 1.5, fontFamily: FONT_SANS }}>
        This estimate is based on your study patterns. We recommend booking when you consistently score 78%+ on full mock exams.
      </div>
    </Card>
  );
}

// ── Main content ───────────────────────────────────────────────────────────
function ProgressContent() {
  const examId = SAA_C03_EXAM_ID;

  const { data: fullStats,      isLoading: statsLoading }    = trpc.progress.getFullStats.useQuery();
  const { data: trendData,      isLoading: trendLoading }    = trpc.progress.getReadinessTrend.useQuery({ days: 30 });
  const { data: domainProgress, isLoading: domainLoading }   = trpc.progress.getDomainProgress.useQuery({ examId });
  const { data: studyTime,      isLoading: studyLoading }    = trpc.progress.getStudyTime.useQuery({ days: 14 });
  const { data: accuracyTrends, isLoading: accuracyLoading } = trpc.progress.getAccuracyTrends.useQuery();
  const { data: passDate,       isLoading: passLoading }     = trpc.progress.getPredictedPassDate.useQuery();

  const daysStudying     = fullStats?.daysStudying     ?? 0;
  const subscriptionTier = fullStats?.subscriptionTier ?? "free";

  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: C.text, fontFamily: FONT_SANS, marginBottom: 4 }}>
        Progress
      </h1>
      <p style={{ fontSize: 13, color: C.muted, fontFamily: FONT_SANS, marginBottom: 28 }}>
        SAA-C03 · {daysStudying} day{daysStudying !== 1 ? "s" : ""} studying
      </p>

      <div className="progress-grid">
        {/* Left column */}
        <div>
          <ReadinessCard
            trend={trendData?.trend ?? []}
            currentScore={trendData?.currentScore ?? 0}
            deltaThisWeek={trendData?.deltaThisWeek ?? 0}
            loading={trendLoading}
          />
          <StudyTimeCard
            daily={studyTime?.daily ?? []}
            weeklyAvgMinutes={studyTime?.weeklyAvgMinutes ?? 0}
            loading={studyLoading}
          />
          <AccuracyTrendsCard
            trends={accuracyTrends ?? []}
            loading={accuracyLoading}
          />
        </div>

        {/* Right column */}
        <div>
          <DomainHeatmap
            domains={(domainProgress ?? []) as {
              domain_id:       string;
              mastery_percent: number;
              domains:         { name: string; code: string; display_order: number } | null;
            }[]}
            loading={domainLoading}
          />
          <QuickStats
            totalQuestions={fullStats?.totalQuestions ?? 0}
            totalSessions={fullStats?.totalSessions   ?? 0}
            bestStreak={fullStats?.bestStreak         ?? 0}
            mockExamCount={fullStats?.mockExamCount   ?? 0}
            loading={statsLoading}
          />
          <PredictedPassCard
            result={passDate as PassResult | undefined}
            subscriptionTier={subscriptionTier}
            loading={passLoading}
          />
        </div>
      </div>

      <style>{`
        .progress-grid {
          display: grid;
          grid-template-columns: 60% 1fr;
          gap: 24px;
          align-items: start;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1);    }
        }
        @media (max-width: 768px) {
          .progress-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

export default function ProgressPage() {
  return <ProgressContent />;
}
