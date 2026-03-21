"use client";

import { motion } from "framer-motion";
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

export default function StudyPage() {
  const { data: domains, isLoading } = trpc.study.getSkillTree.useQuery({
    examId: SAA_C03_EXAM_ID,
  });

  return (
    <div style={{ padding: "24px 0" }}>
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
                        <p style={{ fontSize: 12, color: "#52526B", margin: 0 }}>
                          {domain.questionsAnswered} questions answered · Last practiced {formatDate(domain.lastPracticed)}
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
            <div className="study-skill-tree" style={{ marginTop: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F5", marginBottom: 16 }}>
                Skill Tree
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 24,
                  justifyItems: "center",
                  maxWidth: 400,
                  margin: "0 auto",
                  position: "relative",
                }}
              >
                {/* Connecting lines (SVG behind nodes) */}
                <svg
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                  viewBox="0 0 400 200"
                  preserveAspectRatio="none"
                >
                  {/* Horizontal lines row 1 */}
                  <line x1="67" y1="50" x2="200" y2="50" stroke="#2A2A38" strokeWidth="1" />
                  <line x1="200" y1="50" x2="333" y2="50" stroke="#2A2A38" strokeWidth="1" />
                  {/* Horizontal lines row 2 */}
                  <line x1="67" y1="150" x2="200" y2="150" stroke="#2A2A38" strokeWidth="1" />
                  <line x1="200" y1="150" x2="333" y2="150" stroke="#2A2A38" strokeWidth="1" />
                  {/* Vertical lines */}
                  <line x1="67" y1="50" x2="67" y2="150" stroke="#2A2A38" strokeWidth="1" />
                  <line x1="333" y1="50" x2="333" y2="150" stroke="#2A2A38" strokeWidth="1" />
                </svg>

                {domains.map((domain) => {
                  const colors = masteryColor(domain.mastery);
                  return (
                    <Link key={domain.id} href={`/study/${domain.id}`} style={{ textDecoration: "none" }}>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          border: `2px solid ${colors.text}`,
                          background: colors.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          position: "relative",
                          zIndex: 1,
                        }}
                        title={`${domain.name} — ${domain.mastery}%`}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: colors.text, fontFamily: "var(--font-geist-mono)" }}>
                          {abbreviate(domain.name)}
                        </span>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      <style>{`
        @media (max-width: 640px) {
          .study-domain-card { padding: 16px !important; gap: 12px !important; }
          .study-domain-card .domain-number { width: 36px !important; height: 36px !important; }
          .study-domain-card .domain-number span { font-size: 14px !important; }
          .study-domain-card .domain-mastery { font-size: 16px !important; }
          .study-skill-tree { display: none !important; }
        }
      `}</style>
    </div>
  );
}
