"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Shield, Zap, Trophy } from "lucide-react";
import type { BadgeEarned } from "@/types";

interface BadgeUnlockProps {
  badge: BadgeEarned;
  index: number;
  onDismiss: (badgeId: string) => void;
}

const RARITY_STYLES: Record<string, { bg: string; border: string; iconColor: string }> = {
  common:    { bg: "#4ADE8030", border: "#4ADE8050", iconColor: "#4ADE80" },
  rare:      { bg: "#00C97C30", border: "#00C97C50", iconColor: "#00C97C" },
  epic:      { bg: "#8B5CF630", border: "#8B5CF650", iconColor: "#8B5CF6" },
  legendary: { bg: "#F59E0B30", border: "#F59E0B50", iconColor: "#F59E0B" },
};

const RARITY_ICONS: Record<string, React.ElementType> = {
  common: Star,
  rare: Shield,
  epic: Zap,
  legendary: Trophy,
};

export function BadgeUnlock({ badge, index, onDismiss }: BadgeUnlockProps) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(badge.badgeId), 4000);
    return () => clearTimeout(t);
  }, [badge.badgeId, onDismiss]);

  const styles = RARITY_STYLES[badge.rarity] ?? RARITY_STYLES.common;
  const Icon = RARITY_ICONS[badge.rarity] ?? Star;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          position: "fixed",
          bottom: 24 + index * 88,
          right: 24,
          zIndex: 9998,
          width: 300,
          background: "#13131A",
          border: `1px solid ${styles.border}`,
          borderRadius: 10,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
        onClick={() => onDismiss(badge.badgeId)}
      >
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: styles.bg, border: `1px solid ${styles.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={20} style={{ color: styles.iconColor }} />
        </div>

        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11, color: "#52526B", margin: "0 0 3px", fontFamily: "var(--font-geist-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Badge Earned
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#F1F1F5", margin: "0 0 2px", fontFamily: "var(--font-geist-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {badge.name}
          </p>
          {badge.xpReward > 0 && (
            <p style={{ fontSize: 12, color: "#8B8BA7", margin: 0, fontFamily: "var(--font-geist-sans)" }}>
              +{badge.xpReward} XP
            </p>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
