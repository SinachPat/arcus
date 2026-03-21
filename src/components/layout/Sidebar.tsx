"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  TrendingUp,
  User,
  Trophy,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import { ROUTES } from "@/lib/constants";

const primaryNav = [
  { href: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.study,     label: "Study",      icon: BookOpen },
  { href: ROUTES.tutor,     label: "AI Tutor",   icon: MessageSquare },
  { href: ROUTES.progress,  label: "Progress",   icon: TrendingUp },
  { href: ROUTES.profile,   label: "Profile",    icon: User },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        height: 40,
        padding: "0 12px",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        background: active ? "#00C97C20" : "transparent",
        transition: "background 0.15s",
      }}
      onMouseOver={(e) => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "#1C1C26";
      }}
      onMouseOut={(e) => {
        if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
      }}
    >
      <Icon
        size={18}
        style={{ color: active ? "#00C97C" : "#52526B", flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 14,
          fontFamily: "var(--font-geist-sans)",
          color: active ? "#00C97C" : "#8B8BA7",
          fontWeight: active ? 500 : 400,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

function getInitials(name: string | undefined, email: string | undefined): string {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return "?";
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, profile, reset } = useAuthStore();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    reset();
    router.push("/login");
  }

  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email;
  const initials    = getInitials(
    user?.user_metadata?.full_name as string | undefined,
    user?.email
  );
  const tier = profile?.subscription_tier ?? "free";

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        width: 240,
        background: "#13131A",
        borderRight: "1px solid #2A2A38",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          paddingBottom: 28,
          borderBottom: "1px solid #2A2A38",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#00C97C",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#F1F1F5",
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          ARCUS
        </span>
      </div>

      {/* Primary nav */}
      <nav style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 2 }}>
        {primaryNav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(item.href)}
          />
        ))}
      </nav>

      {/* Secondary nav */}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
        <NavLink
          href={ROUTES.leaderboard}
          label="Leaderboard"
          icon={Trophy}
          active={isActive(ROUTES.leaderboard)}
        />
      </div>

      {/* Bottom section */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* User row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 4px",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#1C1C26",
              border: "1px solid #2A2A38",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: "#F1F1F5",
              flexShrink: 0,
              fontFamily: "var(--font-geist-sans)",
            }}
          >
            {initials}
          </div>

          {/* Name + tier */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#F1F1F5",
                fontFamily: "var(--font-geist-sans)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName ?? "User"}
            </p>
          </div>

          {/* Tier badge */}
          <span
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 999,
              fontFamily: "var(--font-geist-sans)",
              background: tier === "free" ? "#52526B30" : "#00C97C20",
              color: tier === "free" ? "#8B8BA7" : "#00C97C",
              flexShrink: 0,
            }}
          >
            {tier.toUpperCase()}
          </span>
        </div>

        {/* Settings link */}
        <NavLink
          href={ROUTES.settings}
          label="Settings"
          icon={Settings}
          active={isActive(ROUTES.settings)}
        />

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          style={{
            padding: "8px 12px 0",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "#52526B",
            fontFamily: "var(--font-geist-sans)",
            textAlign: "left",
            transition: "color 0.15s",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#EF4444")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#52526B")}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
