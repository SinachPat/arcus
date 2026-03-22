"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakCelebrationProps {
  days: number;
  onDismiss: () => void;
}

export function StreakCelebration({ days, onDismiss }: StreakCelebrationProps) {
  useEffect(() => {
    // Dynamically import canvas-confetti to keep SSR safe
    import("canvas-confetti").then((module) => {
      const confetti = module.default;
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00C97C", "#4ADE80", "#F59E0B", "#F1F1F5"],
        zIndex: 9997,
      });
    });

    const t = setTimeout(onDismiss, 2500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 9998,
        background: "#13131A",
        border: "1px solid rgba(245,158,11,0.3)",
        borderRadius: 16,
        padding: "32px 40px",
        textAlign: "center",
        pointerEvents: "none",
        boxShadow: "0 0 48px rgba(245,158,11,0.15)",
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [-5, 5, -5, 0] }}
        transition={{ duration: 0.6 }}
      >
        <Flame size={48} style={{ color: "#F59E0B" }} />
      </motion.div>
      <p style={{ fontSize: 11, letterSpacing: "0.15em", color: "#F59E0B", margin: "12px 0 6px", textTransform: "uppercase", fontWeight: 600 }}>
        Streak Milestone
      </p>
      <p style={{ fontSize: 48, fontFamily: "var(--font-geist-mono)", fontWeight: 800, color: "#F1F1F5", margin: 0, lineHeight: 1 }}>
        {days}
      </p>
      <p style={{ fontSize: 14, color: "#8B8BA7", margin: "8px 0 0" }}>
        Day streak 🔥
      </p>
    </motion.div>
  );
}
