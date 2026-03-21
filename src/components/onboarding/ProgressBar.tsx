"use client";

import { motion } from "framer-motion";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

/**
 * 5-segment progress indicator for the onboarding wizard.
 *
 * - Active segment fills left-to-right over 400ms.
 * - Completed segments are accent at 40% opacity.
 * - Inactive segments are border-colored.
 */
export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepIndex = i + 1;
        const isCompleted = stepIndex < currentStep;
        const isActive = stepIndex === currentStep;

        return (
          <div
            key={i}
            style={{
              width: 48,
              height: 3,
              borderRadius: 2,
              background: isCompleted
                ? "rgba(0, 201, 124, 0.4)"
                : isActive
                  ? "#2A2A38"
                  : "#2A2A38",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {isActive && (
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  borderRadius: 2,
                  background: "#00C97C",
                }}
              />
            )}
            {isCompleted && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  borderRadius: 2,
                  background: "rgba(0, 201, 124, 0.4)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
