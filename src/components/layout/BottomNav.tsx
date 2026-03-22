"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Swords,
  TrendingUp,
  User,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { AI_MESSAGE_LIMITS } from "@/lib/constants";
import { ROUTES } from "@/lib/constants";

const navItems = [
  { href: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard, showDot: false },
  { href: ROUTES.practice,  label: "Practice",  icon: Swords,          showDot: false },
  { href: ROUTES.tutor,     label: "AI Tutor",  icon: MessageSquare,   showDot: true  },
  { href: ROUTES.progress,  label: "Progress",  icon: TrendingUp,      showDot: false },
  { href: ROUTES.profile,   label: "Profile",   icon: User,            showDot: false },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuthStore();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  // Show amber dot on AI Tutor when there are still unused messages today
  const hasUnusedMessages = profile
    ? profile.daily_ai_messages_used < AI_MESSAGE_LIMITS[profile.subscription_tier]
    : false;

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: "#13131A",
        borderTop: "1px solid #2A2A38",
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 50,
      }}
    >
      {navItems.map((item) => {
        const active    = isActive(item.href);
        const showBadge = item.showDot && hasUnusedMessages;

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              textDecoration: "none",
              color: active ? "#00C97C" : "#52526B",
              transition: "color 0.15s",
              position: "relative",
            }}
          >
            {/* Icon wrapper with optional badge dot */}
            <span style={{ position: "relative", display: "inline-flex" }}>
              <item.icon size={22} />
              {showBadge && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -4,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#F59E0B",
                    border: "1.5px solid #13131A",
                  }}
                />
              )}
            </span>

            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-geist-sans)",
                fontWeight: active ? 500 : 400,
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
