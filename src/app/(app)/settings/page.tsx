"use client";

import { useState, useEffect } from "react";
import { Check, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  surface:  "#13131A",
  border:   "#2A2A38",
  accent:   "#00C97C",
  accentBg: "rgba(0,201,124,0.10)",
  danger:   "#EF4444",
  text:     "#F1F1F5",
  muted:    "#8B8BA7",
  dim:      "#52526B",
  overlay:  "#1C1C26",
} as const;

const SANS = "var(--font-geist-sans)";
const MONO = "var(--font-geist-mono)";

// ── Daily goal options ────────────────────────────────────────────────────────

const GOAL_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

function goalLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Reusable primitives ───────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "22px 24px",
        marginBottom: 14,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0, fontFamily: SANS }}>
          {title}
        </h2>
        {description && (
          <p style={{ fontSize: 13, color: C.muted, margin: "3px 0 0", fontFamily: SANS, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Rule() {
  return <div style={{ height: 1, background: C.border, margin: "18px 0" }} />;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, color: C.dim, margin: "0 0 7px", fontFamily: MONO, letterSpacing: "0.05em" }}>
      {children}
    </p>
  );
}

function SaveBtn({
  dirty,
  saving,
  saved,
  onClick,
}: {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!dirty || saving}
      style={{
        padding: "8px 18px",
        background: saved ? "transparent" : dirty ? C.accent : "transparent",
        border: `1px solid ${saved ? C.border : dirty ? C.accent : C.border}`,
        borderRadius: 8,
        color: saved ? C.muted : dirty ? "#0A0A0F" : C.dim,
        fontSize: 13,
        fontWeight: 600,
        cursor: dirty && !saving ? "pointer" : "default",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: SANS,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {saved ? <><Check size={13} /> Saved</> : saving ? "Saving…" : "Save changes"}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const utils = trpc.useUtils();

  const { data: profileData, isLoading } = trpc.profile.get.useQuery();
  const { data: subData } = trpc.subscription.get.useQuery();

  const updatePrefs   = trpc.profile.updatePreferences.useMutation({ onSuccess: () => utils.profile.get.invalidate() });
  const updateAccount = trpc.auth.updateProfile.useMutation({ onSuccess: () => utils.profile.get.invalidate() });

  // ── Study goal ──────────────────────────────────────────────────────────
  const [goalMins, setGoalMins]     = useState(15);
  const [serverGoal, setServerGoal] = useState(15);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSaved, setGoalSaved]   = useState(false);

  // ── Tutor mode ──────────────────────────────────────────────────────────
  const [tutorMode, setTutorMode]     = useState<"socratic" | "direct">("socratic");
  const [serverTutor, setServerTutor] = useState<"socratic" | "direct">("socratic");
  const [tutorSaving, setTutorSaving] = useState(false);
  const [tutorSaved, setTutorSaved]   = useState(false);

  // ── Display name ────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState("");
  const [serverName, setServerName]   = useState("");
  const [nameSaving, setNameSaving]   = useState(false);
  const [nameSaved, setNameSaved]     = useState(false);
  const [nameError, setNameError]     = useState("");

  // ── Password reset ──────────────────────────────────────────────────────
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent">("idle");

  // Hydrate from server
  useEffect(() => {
    if (!profileData) return;
    const p = profileData as Record<string, unknown>;
    const u = (p.users as Record<string, unknown>) ?? {};

    const goal = (p.daily_goal_minutes as number) ?? 15;
    setGoalMins(goal); setServerGoal(goal);

    const mode = (p.tutor_mode_preference as "socratic" | "direct") ?? "socratic";
    setTutorMode(mode); setServerTutor(mode);

    const name = (u.name as string) ?? "";
    setDisplayName(name); setServerName(name);
  }, [profileData]);

  // Auto-clear "Saved" after 2.5 s
  useEffect(() => { if (!goalSaved)  return; const t = setTimeout(() => setGoalSaved(false),  2500); return () => clearTimeout(t); }, [goalSaved]);
  useEffect(() => { if (!tutorSaved) return; const t = setTimeout(() => setTutorSaved(false), 2500); return () => clearTimeout(t); }, [tutorSaved]);
  useEffect(() => { if (!nameSaved)  return; const t = setTimeout(() => setNameSaved(false),  2500); return () => clearTimeout(t); }, [nameSaved]);

  // ── Handlers ────────────────────────────────────────────────────────────

  async function saveGoal() {
    setGoalSaving(true);
    try {
      await updatePrefs.mutateAsync({ dailyGoalMinutes: goalMins });
      setServerGoal(goalMins);
      setGoalSaved(true);
    } finally { setGoalSaving(false); }
  }

  async function saveTutor() {
    setTutorSaving(true);
    try {
      await updatePrefs.mutateAsync({ tutorModePreference: tutorMode });
      setServerTutor(tutorMode);
      setTutorSaved(true);
    } finally { setTutorSaving(false); }
  }

  async function saveName() {
    if (!displayName.trim()) { setNameError("Name cannot be empty."); return; }
    setNameError("");
    setNameSaving(true);
    try {
      await updateAccount.mutateAsync({ name: displayName.trim() });
      setServerName(displayName.trim());
      setNameSaved(true);
    } catch {
      setNameError("Failed to update. Please try again.");
    } finally { setNameSaving(false); }
  }

  async function sendPasswordReset() {
    const p = profileData as Record<string, unknown> | undefined;
    const email = ((p?.users as Record<string, unknown>)?.email as string) ?? "";
    if (!email) return;
    setResetState("sending");
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setResetState("sent");
  }

  // ── Dirty flags ──────────────────────────────────────────────────────────
  const goalDirty  = goalMins !== serverGoal;
  const tutorDirty = tutorMode !== serverTutor;
  const nameDirty  = displayName.trim() !== serverName;

  // ── Derived values ───────────────────────────────────────────────────────
  const p     = (profileData as Record<string, unknown>) ?? {};
  const u     = (p.users as Record<string, unknown>) ?? {};
  const email = (u.email as string) ?? "";
  const tier  = (subData?.tier ?? "free") as string;

  const tierLabel: Record<string, string> = { free: "Free", pro: "Pro", premium: "Premium" };
  const tierLimits: Record<string, string> = {
    free:    "20 questions / day  ·  3 AI messages / day  ·  1 mock / month",
    pro:     "Unlimited questions  ·  50 AI messages / day  ·  Unlimited mocks",
    premium: "Unlimited everything  ·  150 AI messages  ·  Predicted pass date",
  };

  // ── Skeleton ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ maxWidth: 560, paddingTop: 32 }}>
        {[140, 190, 220, 90].map((h, i) => (
          <div key={i} className="animate-pulse"
            style={{ height: h, background: C.surface, borderRadius: 12, marginBottom: 14 }} />
        ))}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 560, paddingTop: 32, paddingBottom: 80, fontFamily: SANS }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 22, letterSpacing: "-0.01em" }}>
        Settings
      </h1>

      {/* ── Study Goal ──────────────────────────────────────────────────── */}
      <SectionCard
        title="Study Goal"
        description="How much time you want to study each day — shapes your streak and daily target."
      >
        <FieldLabel>DAILY TARGET</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
          {GOAL_OPTIONS.map((mins) => {
            const active = goalMins === mins;
            return (
              <button
                key={mins}
                onClick={() => setGoalMins(mins)}
                style={{
                  padding: "7px 13px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: active ? C.accentBg : "transparent",
                  border: `1px solid ${active ? C.accent : C.border}`,
                  color: active ? C.accent : C.muted,
                  cursor: "pointer",
                  fontFamily: MONO,
                  transition: "all 0.12s",
                }}
              >
                {goalLabel(mins)}
              </button>
            );
          })}
        </div>
        <SaveBtn dirty={goalDirty} saving={goalSaving} saved={goalSaved} onClick={saveGoal} />
      </SectionCard>

      {/* ── AI Tutor ─────────────────────────────────────────────────────── */}
      <SectionCard
        title="AI Tutor"
        description="Default mode when you open the tutor. You can switch any time mid-session."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
          {(["socratic", "direct"] as const).map((mode) => {
            const active = tutorMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setTutorMode(mode)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: active ? C.accentBg : "transparent",
                  border: `1px solid ${active ? C.accent : C.border}`,
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: SANS,
                  transition: "all 0.12s",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: active ? C.accent : C.muted, marginBottom: 4 }}>
                  {mode === "socratic" ? "🧠  Socratic" : "⚡  Direct"}
                </div>
                <div style={{ fontSize: 12, color: active ? "rgba(0,201,124,0.65)" : C.dim, lineHeight: 1.45 }}>
                  {mode === "socratic"
                    ? "Guided questions, deeper understanding"
                    : "Answer first, explanation follows"}
                </div>
              </button>
            );
          })}
        </div>
        <SaveBtn dirty={tutorDirty} saving={tutorSaving} saved={tutorSaved} onClick={saveTutor} />
      </SectionCard>

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <SectionCard title="Account">

        {/* Display name */}
        <FieldLabel>DISPLAY NAME</FieldLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: nameError ? 0 : 0 }}>
          <div style={{ flex: 1 }}>
            <input
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setNameError(""); }}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="Your name"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: C.overlay,
                border: `1px solid ${nameError ? C.danger : C.border}`,
                borderRadius: 8,
                padding: "9px 12px",
                color: C.text,
                fontSize: 14,
                fontFamily: SANS,
                outline: "none",
              }}
            />
            {nameError && (
              <p style={{ fontSize: 12, color: C.danger, margin: "4px 0 0" }}>{nameError}</p>
            )}
          </div>
          <SaveBtn dirty={nameDirty} saving={nameSaving} saved={nameSaved} onClick={saveName} />
        </div>

        <Rule />

        {/* Email (read-only) */}
        <FieldLabel>EMAIL</FieldLabel>
        <div
          style={{
            background: C.overlay,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "9px 12px",
            color: C.dim,
            fontSize: 14,
            fontFamily: SANS,
            marginBottom: 5,
          }}
        >
          {email || "—"}
        </div>
        <p style={{ fontSize: 11, color: C.dim, margin: 0 }}>
          To change your email address, contact support.
        </p>

        <Rule />

        {/* Password reset */}
        <FieldLabel>PASSWORD</FieldLabel>
        {resetState === "sent" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: C.accent, fontSize: 13 }}>
            <Check size={15} /> Reset link sent — check your inbox.
          </div>
        ) : (
          <button
            onClick={sendPasswordReset}
            disabled={resetState === "sending"}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              color: C.muted,
              fontSize: 13,
              cursor: resetState === "sending" ? "wait" : "pointer",
              fontFamily: SANS,
              transition: "border-color 0.12s, color 0.12s",
            }}
          >
            {resetState === "sending" ? "Sending…" : "Send password reset email"}
          </button>
        )}
      </SectionCard>

      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      <SectionCard title="Plan">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 100,
                background: tier === "free" ? C.overlay : C.accentBg,
                border: `1px solid ${tier === "free" ? C.border : C.accent}`,
                color: tier === "free" ? C.muted : C.accent,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                fontFamily: MONO,
                marginBottom: 7,
              }}
            >
              {tierLabel[tier] ?? tier}
            </span>
            <p style={{ fontSize: 12, color: C.dim, margin: 0, lineHeight: 1.6 }}>
              {tierLimits[tier] ?? ""}
            </p>
          </div>

          {tier === "free" && (
            <button
              disabled
              title="Paid plans coming soon"
              style={{
                padding: "8px 18px",
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                color: C.dim,
                fontSize: 13,
                fontWeight: 600,
                cursor: "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: SANS,
              }}
            >
              <Lock size={13} /> Upgrade — coming soon
            </button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
