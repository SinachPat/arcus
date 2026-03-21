"use client";

import { PlayCircle, Target, Clock, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { SAA_C03_EXAM_ID, SAA_C03_DOMAIN_IDS } from "@/lib/constants";
import Link from "next/link";

const DOMAIN_LABELS: Record<string, string> = {
  [SAA_C03_DOMAIN_IDS.RESILIENT]: "Resilient Architectures",
  [SAA_C03_DOMAIN_IDS.PERFORMANCE]: "High-Performing",
  [SAA_C03_DOMAIN_IDS.SECURITY]: "Secure Applications",
  [SAA_C03_DOMAIN_IDS.COST]: "Cost-Optimized",
  [SAA_C03_DOMAIN_IDS.OPERATIONS]: "Ops Excellence",
  [SAA_C03_DOMAIN_IDS.IMPROVEMENT]: "Continuous Improvement",
};

export default function PracticePage() {
  const { data } = trpc.study.getDashboardData.useQuery();

  const weakDomainName = data?.weakestDomainId
    ? DOMAIN_LABELS[data.weakestDomainId] ?? "Your weakest area"
    : "Your weakest area";

  const cards = [
    {
      icon: <PlayCircle size={40} style={{ color: "#00C97C" }} />,
      title: "Quick Quiz",
      subtitle: "10 questions · ~8 minutes · Focused on your weakest area",
      badge: `Recommended: ${weakDomainName}`,
      href: data?.weakestDomainId
        ? `/practice/quiz?count=10&domainId=${data.weakestDomainId}`
        : "/practice/quiz?count=10",
    },
    {
      icon: <Target size={40} style={{ color: "#F59E0B" }} />,
      title: "Weak Area Drill",
      subtitle: "20 questions · Drill your lowest-scoring domain",
      badge: null,
      href: data?.weakestDomainId
        ? `/practice/quiz?count=20&domainId=${data.weakestDomainId}`
        : "/practice/quiz?count=20",
    },
    {
      icon: <Clock size={40} style={{ color: "#22D3EE" }} />,
      title: "Mock Exam",
      subtitle: "Full simulation · Timed · Matches real SAA-C03 format",
      badge: null,
      href: "/practice/mock",
    },
  ];

  return (
    <div style={{ padding: "24px 0" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: "#F1F1F5", marginBottom: 24 }}>
        Practice
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cards.map((card) => (
          <Link key={card.title} href={card.href} style={{ textDecoration: "none" }}>
            <div
              className="practice-card"
              style={{
                background: "#13131A",
                border: "1px solid #2A2A38",
                borderRadius: 10,
                padding: 24,
                display: "flex",
                alignItems: "center",
                gap: 20,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D3D52")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A38")}
            >
              <div className="practice-card-icon" style={{ flexShrink: 0 }}>{card.icon}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>
                  {card.title}
                </p>
                <p style={{ fontSize: 13, color: "#8B8BA7", margin: "4px 0 0 0" }}>
                  {card.subtitle}
                </p>
                {card.badge && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      background: "rgba(0,201,124,0.125)",
                      color: "#00C97C",
                      fontSize: 11,
                      borderRadius: 100,
                      padding: "3px 10px",
                    }}
                  >
                    {card.badge}
                  </span>
                )}
              </div>

              <button
                className="practice-start-btn"
                style={{
                  height: 40,
                  border: "1px solid #00C97C",
                  borderRadius: 6,
                  padding: "0 16px",
                  fontSize: 13,
                  color: "#00C97C",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "inherit",
                  flexShrink: 0,
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#00C97C";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#00C97C";
                }}
              >
                Start <ChevronRight size={16} />
              </button>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .practice-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            padding: 20px !important;
          }
          .practice-card-icon { display: none !important; }
          .practice-start-btn {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}
