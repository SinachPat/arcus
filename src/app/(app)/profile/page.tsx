"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { createClient } from "@/lib/supabase/client";
import {
  Settings,
  LogOut,
  HelpCircle,
  ChevronRight,
  Shield,
  Star,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

function getInitials(name: string | undefined, email: string | undefined): string {
  if (name) {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  }
  if (email) return email.charAt(0).toUpperCase();
  return "?";
}

// ── Reusable row ──────────────────────────────────────────────────────────────

function MenuRow({
  icon: Icon,
  label,
  sublabel,
  href,
  onClick,
  danger,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  iconColor?: string;
}) {
  const iconBg     = danger ? "rgba(239,68,68,0.12)" : "#1C1C26";
  const resolvedIconColor = danger ? "#EF4444" : (iconColor ?? "#8B8BA7");
  const textColor  = danger ? "#EF4444" : "#F1F1F5";

  const inner = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 16px",
        cursor: "pointer",
        transition: "background 0.12s",
        background: "transparent",
        border: "none",
        width: "100%",
        textAlign: "left",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#1C1C26")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      {/* Icon circle */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={17} style={{ color: resolvedIconColor }} />
      </div>

      {/* Label + sublabel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, color: textColor, margin: 0, fontFamily: "var(--font-geist-sans)" }}>
          {label}
        </p>
        {sublabel && (
          <p style={{ fontSize: 12, color: "#52526B", margin: "2px 0 0 0", fontFamily: "var(--font-geist-sans)" }}>
            {sublabel}
          </p>
        )}
      </div>

      {!danger && (
        <ChevronRight size={16} style={{ color: "#52526B", flexShrink: 0 }} />
      )}
    </div>
  );

  if (href) {
    return <Link href={href} style={{ display: "block", textDecoration: "none" }}>{inner}</Link>;
  }

  return (
    <button onClick={onClick} style={{ display: "block", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
      {inner}
    </button>
  );
}

function MenuSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {title && (
        <p style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "#52526B",
          textTransform: "uppercase",
          fontFamily: "var(--font-geist-sans)",
          marginBottom: 6,
          paddingLeft: 4,
        }}>
          {title}
        </p>
      )}
      <div style={{
        background: "#13131A",
        border: "1px solid #2A2A38",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div style={{ height: 1, background: "#2A2A38", marginLeft: 66 }} />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile, reset } = useAuthStore();

  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "User";
  const email       = user?.email ?? "";
  const initials    = getInitials(user?.user_metadata?.full_name as string | undefined, email);
  const tier        = profile?.subscription_tier ?? "free";
  const level       = profile?.level ?? 1;
  const xp          = profile?.xp ?? 0;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    reset();
    router.push("/login");
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: "#F1F1F5", marginBottom: 24, fontFamily: "var(--font-geist-sans)" }}>
        Profile
      </h1>

      {/* ── User card ── */}
      <div style={{
        background: "#13131A",
        border: "1px solid #2A2A38",
        borderRadius: 14,
        padding: "20px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Avatar */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#1C1C26",
          border: "2px solid #2A2A38",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
          color: "#F1F1F5",
          flexShrink: 0,
          fontFamily: "var(--font-geist-sans)",
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F5", margin: 0, fontFamily: "var(--font-geist-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayName}
          </p>
          <p style={{ fontSize: 13, color: "#52526B", margin: "2px 0 0 0", fontFamily: "var(--font-geist-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            {/* Tier badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", padding: "3px 8px", borderRadius: 999,
              fontFamily: "var(--font-geist-sans)",
              background: tier === "free" ? "#52526B30" : "#00C97C20",
              color: tier === "free" ? "#8B8BA7" : "#00C97C",
            }}>
              {tier}
            </span>
            {/* Level */}
            <span style={{ fontSize: 12, color: "#52526B", fontFamily: "var(--font-geist-mono)" }}>
              Lv.{level} · {xp.toLocaleString()} XP
            </span>
          </div>
        </div>
      </div>

      {/* ── Account section ── */}
      <MenuSection title="Account">
        <MenuRow
          icon={Settings}
          label="Settings"
          sublabel="Preferences, notifications"
          href={ROUTES.settings}
          iconColor="#8B8BA7"
        />
        <Divider />
        <MenuRow
          icon={Trophy}
          label="Leaderboard"
          sublabel="See how you rank this week"
          href={ROUTES.leaderboard}
          iconColor="#F59E0B"
        />
        <Divider />
        <MenuRow
          icon={Star}
          label="Upgrade to Pro"
          sublabel="Unlimited AI Tutor, mock exams"
          href="/upgrade"
          iconColor="#00C97C"
        />
      </MenuSection>

      {/* ── Support section ── */}
      <MenuSection title="Support">
        <MenuRow
          icon={HelpCircle}
          label="Help & Support"
          sublabel="Docs, FAQs, contact us"
          href="mailto:support@arcus.study"
          iconColor="#8B8BA7"
        />
        <Divider />
        <MenuRow
          icon={Shield}
          label="Privacy Policy"
          href="/privacy"
          iconColor="#8B8BA7"
        />
      </MenuSection>

      {/* ── Sign out ── */}
      <MenuSection>
        <MenuRow
          icon={LogOut}
          label="Sign out"
          onClick={handleSignOut}
          danger
        />
      </MenuSection>

      {/* App version — subtle footer */}
      <p style={{ textAlign: "center", fontSize: 11, color: "#2A2A38", marginTop: 8, fontFamily: "var(--font-geist-mono)" }}>
        Arcus v0.1.0
      </p>
    </div>
  );
}
