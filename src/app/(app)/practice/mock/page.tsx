"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ClipboardList, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useMockExamStore } from "@/store/mockExam";
import { SAA_C03_EXAM_ID, MOCK_EXAM_MODES } from "@/lib/constants";

type Mode = "full" | "half" | "quick";

const MODES: Array<{
  id: Mode;
  label: string;
  details: string;
  xpLabel: string;
  icon: React.ReactNode;
}> = [
  {
    id: "full",
    label: "Full Exam",
    details: "65 questions · 130 minutes",
    xpLabel: "Up to 500 XP",
    icon: <ClipboardList size={20} color="#F1F1F5" />,
  },
  {
    id: "half",
    label: "Half Exam",
    details: "32 questions · 65 minutes",
    xpLabel: "Up to 250 XP",
    icon: <ClipboardList size={20} color="#8B8BA7" />,
  },
  {
    id: "quick",
    label: "Quick Exam",
    details: "15 questions · 30 minutes",
    xpLabel: "Up to 100 XP",
    icon: <Zap size={20} color="#F59E0B" />,
  },
];

const RULES = [
  "Timer enforced — exam auto-submits when time expires",
  "No hints or AI Tutor during the exam",
  "Unanswered questions count as incorrect",
  "Scored on the same 72% passing threshold as the real exam",
];

export default function MockExamConfigPage() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<Mode>("full");
  const initSession = useMockExamStore((s) => s.initSession);

  const startMutation = trpc.mock.start.useMutation({
    onSuccess(data) {
      initSession(
        data.sessionId,
        selectedMode,
        data.timeLimitSeconds,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.questions as any
      );
      router.push("/practice/mock/session?sessionId=" + data.sessionId);
    },
  });

  const isLoading = startMutation.isPending;

  function handleStart() {
    if (isLoading) return;
    startMutation.mutate({ examId: SAA_C03_EXAM_ID, mode: selectedMode });
  }

  return (
    <div
      style={{
        maxWidth: 620,
        margin: "0 auto",
        paddingTop: 40,
      }}
    >
      {/* Header */}
      <h1
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "#F1F1F5",
          margin: 0,
        }}
      >
        Mock Exam
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#8B8BA7",
          marginTop: 6,
          marginBottom: 32,
        }}
      >
        Simulate the real SAA-C03 experience
      </p>

      {/* Mode cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {MODES.map((mode) => {
          const isSelected = selectedMode === mode.id;
          return (
            <div
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              style={{
                background: isSelected ? "rgba(0,201,124,0.03)" : "#13131A",
                border: `1px solid ${isSelected ? "#00C97C" : "#2A2A38"}`,
                borderRadius: 10,
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = "#3D3D52";
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = "#2A2A38";
              }}
            >
              {/* Icon circle */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: "#1C1C26",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {mode.icon}
              </div>

              {/* Card center */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#F1F1F5",
                    margin: 0,
                  }}
                >
                  {mode.label}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#8B8BA7",
                    margin: "2px 0 0 0",
                  }}
                >
                  {mode.details}
                </p>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 6,
                    fontSize: 11,
                    background: "rgba(0,201,124,0.0627)",
                    border: "1px solid rgba(0,201,124,0.1882)",
                    color: "#00C97C",
                    borderRadius: 100,
                    padding: "2px 8px",
                  }}
                >
                  {mode.xpLabel}
                </span>
              </div>

              {/* Radio circle */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `2px solid ${isSelected ? "#00C97C" : "#3D3D52"}`,
                  background: isSelected ? "#00C97C" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#ffffff",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rules panel */}
      <div
        style={{
          marginTop: 24,
          background: "#13131A",
          border: "1px solid #2A2A38",
          borderRadius: 8,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} color="#F59E0B" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#F1F1F5" }}>
            Exam Rules
          </span>
        </div>
        {RULES.map((rule) => (
          <p
            key={rule}
            style={{
              fontSize: 13,
              color: "#8B8BA7",
              margin: "10px 0 0 0",
              paddingLeft: 24,
            }}
          >
            {rule}
          </p>
        ))}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={isLoading}
        style={{
          marginTop: 28,
          width: "100%",
          height: 52,
          background: "#00C97C",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          color: "#0A0A0F",
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.6 : 1,
          fontFamily: "inherit",
          transition: "opacity 0.15s",
        }}
      >
        {isLoading ? "Starting…" : "Start Exam →"}
      </button>

      {startMutation.isError && (
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "#EF4444",
            textAlign: "center",
          }}
        >
          {startMutation.error.message ?? "Failed to start exam. Please try again."}
        </p>
      )}
    </div>
  );
}
