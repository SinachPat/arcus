"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface LevelUpOverlayProps {
  level: number;
  title: string;
  xpProgress: { current: number; next: number };
  onDismiss: () => void;
}

export function LevelUpOverlay({ level, title, xpProgress, onDismiss }: LevelUpOverlayProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#13131A",
            border: "1px solid rgba(0,201,124,0.25)",
            borderRadius: 16,
            padding: "40px 32px",
            maxWidth: 360,
            width: "calc(100vw - 40px)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles size={48} style={{ color: "#00C97C" }} />
          </motion.div>

          <p style={{ fontSize: 11, letterSpacing: "0.2em", color: "#00C97C", margin: "16px 0 8px", fontFamily: "var(--font-geist-sans)", fontWeight: 600, textTransform: "uppercase" }}>
            Level Up
          </p>

          <p style={{ fontSize: 64, fontFamily: "var(--font-geist-mono)", fontWeight: 800, color: "#F1F1F5", margin: "0 0 8px", lineHeight: 1 }}>
            {level}
          </p>

          <p style={{ fontSize: 18, fontWeight: 500, color: "#8B8BA7", margin: "0 0 8px", fontFamily: "var(--font-geist-sans)" }}>
            {title}
          </p>

          <p style={{ fontSize: 13, color: "#52526B", margin: "0 0 28px", fontFamily: "var(--font-geist-mono)" }}>
            {xpProgress.current.toLocaleString()} / {xpProgress.next.toLocaleString()} XP
          </p>

          <button
            onClick={onDismiss}
            style={{
              height: 48, width: "100%", background: "#00C97C", border: "none",
              borderRadius: 8, fontSize: 15, fontWeight: 500, color: "#0A0A0F",
              cursor: "pointer", fontFamily: "var(--font-geist-sans)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#00B06C")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#00C97C")}
          >
            Keep going →
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
