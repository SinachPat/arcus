"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

interface ExamSelectionProps {
  onNext:   () => void;
  onSelect: (examId: string) => void;
}

export default function ExamSelection({ onNext, onSelect }: ExamSelectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: exams, isLoading } = trpc.onboarding.getExams.useQuery();

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelect(id);
  };

  const handleContinue = () => {
    if (selectedId) onNext();
  };

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
        Step 1 of 5
      </p>

      {/* Heading */}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F1F1F5", margin: 0 }}>
        What are you studying for?
      </h1>

      {/* Subheading */}
      <p style={{ fontSize: 15, color: "#8B8BA7", marginTop: 8, marginBottom: 32 }}>
        We&apos;ll build a personalized prep plan based on your exam
      </p>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 120,
                background: "#13131A",
                borderRadius: 12,
                border: "1px solid #2A2A38",
                animation: "pulse 2s infinite",
              }}
            />
          ))}
        </div>
      )}

      {/* Exam cards */}
      {exams?.map((exam) => {
        const isSelected = selectedId === exam.id;
        return (
          <button
            key={exam.id}
            onClick={() => handleSelect(exam.id)}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "row",
              gap: 16,
              padding: 24,
              background: isSelected ? "rgba(0, 201, 124, 0.063)" : "#13131A",
              border: `1px solid ${isSelected ? "#00C97C" : "#2A2A38"}`,
              borderRadius: 12,
              cursor: "pointer",
              textAlign: "left",
              marginBottom: 12,
              transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
              boxShadow: isSelected ? "0 0 0 1px #00C97C" : "none",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.borderColor = "#3D3D52";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.borderColor = "#2A2A38";
              }
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: "rgba(0, 201, 124, 0.125)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#00C97C" }}>AWS</span>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>
                {exam.name}
              </p>
              <p style={{ fontSize: 12, color: "#8B8BA7", marginTop: 2, marginBottom: 0 }}>
                {exam.code}
              </p>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {[
                  `${exam.domain_count} Domains`,
                  `${exam.time_limit_minutes} min`,
                  exam.estimated_prep_hours ? `~${exam.estimated_prep_hours}hr prep` : null,
                ]
                  .filter(Boolean)
                  .map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "#1C1C26",
                        border: "1px solid #2A2A38",
                        borderRadius: 100,
                        padding: "3px 10px",
                        fontSize: 11,
                        color: "#8B8BA7",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            </div>
          </button>
        );
      })}

      {/* Continue button */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            style={{ marginTop: 24 }}
          >
            <button
              onClick={handleContinue}
              style={{
                width: "100%",
                height: 52,
                background: "#00C97C",
                border: "none",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "inherit",
              }}
            >
              Continue
              <ChevronRight size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
