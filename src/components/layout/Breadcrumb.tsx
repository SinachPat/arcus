"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Map path segments → human-readable labels
const SEGMENT_LABELS: Record<string, string> = {
  dashboard:  "Dashboard",
  study:      "Study",
  practice:   "Practice",
  quiz:       "Quiz",
  mock:       "Mock Exam",
  session:    "Session",
  results:    "Results",
  tutor:      "AI Tutor",
  progress:   "Progress",
  profile:    "Profile",
  leaderboard:"Leaderboard",
  settings:   "Settings",
};

interface Crumb {
  label: string;
  href:  string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let accumulated = "";

  for (const seg of segments) {
    accumulated += `/${seg}`;
    const label = SEGMENT_LABELS[seg] ?? seg;
    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const crumbs   = buildCrumbs(pathname);

  // Don't render on single-level routes (e.g. /dashboard)
  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        4,
        marginBottom: 16,
        flexWrap:   "wrap",
      }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <ChevronRight size={13} style={{ color: "#3D3D52", flexShrink: 0 }} />}
            {isLast ? (
              <span style={{ fontSize: 13, color: "#8B8BA7" }}>{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                style={{
                  fontSize:       13,
                  color:          "#52526B",
                  textDecoration: "none",
                  transition:     "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F1F1F5")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#52526B")}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
