"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

interface XPPopupProps {
  id: string;
  amount: number;
  position?: { x: number; y: number };
  onDone: (id: string) => void;
}

export function XPPopup({ id, amount, position, onDone }: XPPopupProps) {
  useEffect(() => {
    const t = setTimeout(() => onDone(id), 1100);
    return () => clearTimeout(t);
  }, [id, onDone]);

  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: -40 }}
      transition={{ duration: 1, ease: "easeOut" }}
      style={{
        position: "fixed",
        left: position?.x ?? "50%",
        top: position?.y ?? "50%",
        transform: position ? "translate(-50%, -50%)" : "translate(-50%, -50%)",
        zIndex: 10000,
        pointerEvents: "none",
        fontFamily: "var(--font-geist-mono)",
        fontSize: 14,
        fontWeight: 700,
        color: "#00C97C",
        textShadow: "0 0 8px rgba(0,201,124,0.6)",
        whiteSpace: "nowrap",
      }}
    >
      +{amount} XP
    </motion.div>
  );
}
