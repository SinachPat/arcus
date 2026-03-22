"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Flame, GitBranch } from "lucide-react";
import confetti from "canvas-confetti";
import { trpc } from "@/lib/trpc/client";

const DAILY_GOAL_OPTIONS = [
  { minutes: 10, label: "10 min" },
  { minutes: 15, label: "15 min" },
  { minutes: 20, label: "20 min" },
  { minutes: 30, label: "30 min" },
] as const;

interface Panel {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  body: string;
  demo: React.ReactNode;
}

const PANELS: Panel[] = [
  {
    icon: <Sparkles size={56} />,
    iconColor: "#00C97C",
    title: "Earn XP for every question",
    body: "Answer correctly to earn XP. Harder questions, bigger rewards. Level up as you improve.",
    demo: (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#13131A",
          border: "1px solid #2A2A38",
          borderRadius: 8,
          padding: "12px 16px",
          marginTop: 16,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#4ADE80",
          }}
        />
        <span style={{ flex: 1, fontSize: 13, color: "#F1F1F5" }}>
          What is an S3 bucket policy?
        </span>
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{ fontSize: 14, fontWeight: 700, color: "#00C97C" }}
        >
          +20 XP
        </motion.span>
      </div>
    ),
  },
  {
    icon: <Flame size={56} />,
    iconColor: "#F59E0B",
    title: "Build your daily streak",
    body: "Study every day to keep your streak alive. Earn shields every 7 days that protect you if you miss a day.",
    demo: (
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 16,
        }}
      >
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
          <div
            key={i}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: i < 5 ? "#F59E0B" : "#2A2A38",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: i < 5 ? "#0A0A0F" : "#52526B",
            }}
          >
            {day}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <GitBranch size={56} />,
    iconColor: "#22D3EE",
    title: "Track your mastery",
    body: "Watch domains go from gray to green as you master each concept. Unlock harder topics as you progress.",
    demo: (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16 }}>
        {[
          { name: "Resilient", pct: 78, color: "#F59E0B" },
          { name: "Security", pct: 45, color: "#EF4444" },
          { name: "Cost", pct: 92, color: "#4ADE80" },
        ].map((d) => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#8B8BA7", width: 60 }}>{d.name}</span>
            <div
              style={{
                flex: 1,
                height: 4,
                background: "#2A2A38",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${d.pct}%`,
                  height: "100%",
                  background: d.color,
                  borderRadius: 2,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-geist-mono)",
                color: d.color,
                width: 28,
                textAlign: "right",
              }}
            >
              {d.pct}%
            </span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function GamificationTutorial() {
  const router = useRouter();
  const [panelIdx, setPanelIdx] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(15);
  const [completing, setCompleting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const completeMutation = trpc.onboarding.completeOnboarding.useMutation();

  const panel = PANELS[panelIdx];

  const handleStart = useCallback(async () => {
    if (completing) return;
    setCompleting(true);
    setStartError(null);

    try {
      await completeMutation.mutateAsync({ dailyGoalMinutes: dailyGoal });

      // Confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#00C97C", "#22D3EE", "#F59E0B", "#F1F1F5"],
      });

      // Hard navigate after confetti — bypasses Next.js router cache so
      // AppLayout always fetches a fresh profile from Supabase.
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1500);
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      setStartError("Something went wrong. Please try again.");
      setCompleting(false);
    }
  }, [completing, completeMutation, dailyGoal, router]);

  return (
    <div>
      {/* Step label */}
      <p
        style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          color: "#52526B",
          marginBottom: 12,
          textTransform: "uppercase",
        }}
      >
        Step 5 of 5
      </p>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#F1F1F5",
          margin: 0,
          marginBottom: 28,
        }}
      >
        How Arcus works
      </h1>

      {/* ── Panel carousel ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={panelIdx}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "0 8px",
          }}
        >
          {/* Icon */}
          <div style={{ color: panel.iconColor, marginBottom: 16 }}>{panel.icon}</div>

          {/* Title */}
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#F1F1F5",
              margin: 0,
              marginBottom: 8,
            }}
          >
            {panel.title}
          </h2>

          {/* Body */}
          <p
            style={{
              fontSize: 14,
              color: "#8B8BA7",
              lineHeight: 1.6,
              maxWidth: 380,
              margin: "0 auto",
            }}
          >
            {panel.body}
          </p>

          {/* Demo */}
          <div style={{ width: "100%", maxWidth: 380 }}>{panel.demo}</div>
        </motion.div>
      </AnimatePresence>

      {/* Panel dots */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 24,
          marginBottom: 8,
        }}
      >
        {PANELS.map((_, i) => (
          <button
            key={i}
            onClick={() => setPanelIdx(i)}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: i === panelIdx ? "#F1F1F5" : "#2A2A38",
              border: "none",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>

      {/* Next panel button (if not on last panel) */}
      {panelIdx < PANELS.length - 1 && (
        <button
          onClick={() => setPanelIdx((i) => i + 1)}
          style={{
            display: "block",
            margin: "8px auto 0",
            background: "transparent",
            border: "none",
            color: "#8B8BA7",
            fontSize: 13,
            cursor: "pointer",
            padding: "4px 12px",
          }}
        >
          Next →
        </button>
      )}

      {/* ── Daily goal selector ── */}
      <div style={{ marginTop: 32 }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "#F1F1F5",
            marginBottom: 12,
          }}
        >
          Set your daily goal
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {DAILY_GOAL_OPTIONS.map((opt) => {
            const isSelected = dailyGoal === opt.minutes;
            return (
              <button
                key={opt.minutes}
                onClick={() => setDailyGoal(opt.minutes)}
                style={{
                  height: 56,
                  background: isSelected ? "rgba(0, 201, 124, 0.063)" : "#13131A",
                  border: `1px solid ${isSelected ? "#00C97C" : "#2A2A38"}`,
                  borderRadius: 8,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: isSelected ? "#00C97C" : "#F1F1F5",
                  }}
                >
                  {opt.label}
                </span>
                <span style={{ fontSize: 11, color: "#8B8BA7" }}>per day</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {startError && (
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "#EF4444",
            textAlign: "center",
          }}
        >
          {startError}
        </p>
      )}

      {/* Start button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginTop: 28, marginBottom: 32 }}
      >
        <button
          onClick={handleStart}
          disabled={completing}
          style={{
            width: "100%",
            height: 52,
            background: completing ? "#2A2A38" : "#00C97C",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            color: completing ? "#8B8BA7" : "#fff",
            cursor: completing ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "inherit",
          }}
        >
          {completing ? "Setting up your account..." : "Start studying →"}
        </button>
      </motion.div>
    </div>
  );
}
