"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SelfAssessmentData } from "@/app/onboarding/page";

interface SelfAssessmentProps {
  onNext:     () => void;
  onComplete: (data: SelfAssessmentData) => void;
}

interface Question {
  key: keyof SelfAssessmentData;
  text: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    key: "experience",
    text: "How much AWS experience do you have?",
    options: ["None", "Less than 1 year", "1\u20133 years", "3+ years"],
  },
  {
    key: "productionUsage",
    text: "Have you used VPCs, S3, EC2, and IAM in production?",
    options: [
      "Yes, all of them",
      "Some of them",
      "Mostly theoretical",
      "Not really",
    ],
  },
  {
    key: "priorAttempt",
    text: "Have you taken this exam before?",
    options: [
      "No, first attempt",
      "Yes, didn\u2019t pass",
      "Passed a similar AWS exam",
    ],
  },
  {
    key: "targetDate",
    text: "When is your target exam date?",
    options: [
      "Within 2 weeks",
      "2\u20134 weeks",
      "1\u20133 months",
      "3+ months",
      "Not sure yet",
    ],
  },
  {
    key: "studyHours",
    text: "How many hours per week can you study?",
    options: ["Less than 2 hrs", "2\u20135 hrs", "5\u201310 hrs", "10+ hrs"],
  },
];

export default function SelfAssessment({ onNext, onComplete }: SelfAssessmentProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Partial<SelfAssessmentData>>({});
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  const question = QUESTIONS[currentQ];

  const handleSelect = useCallback(
    (value: string) => {
      const updated = { ...answers, [question.key]: value };
      setAnswers(updated);

      // Auto-advance after 300ms
      setTimeout(() => {
        if (currentQ < QUESTIONS.length - 1) {
          setDirection(1);
          setCurrentQ((q) => q + 1);
        } else {
          // All questions answered — advance to next step
          onComplete(updated as SelfAssessmentData);
          onNext();
        }
      }, 300);
    },
    [answers, currentQ, question.key, onComplete, onNext]
  );

  // Allow keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < question.options.length) {
        handleSelect(question.options[idx]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSelect, question.options]);

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
        Step 2 of 5
      </p>

      {/* Heading */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#F1F1F5",
          margin: 0,
          marginBottom: 32,
        }}
      >
        Tell us about your experience
      </h1>

      {/* Question carousel */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentQ}
          custom={direction}
          initial={{ opacity: 0, x: direction * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -60 }}
          transition={{ duration: 0.2 }}
        >
          {/* Question text */}
          <p
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "#F1F1F5",
              marginBottom: 20,
            }}
          >
            {question.text}
          </p>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {question.options.map((option) => {
              const isSelected = answers[question.key] === option;
              return (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  style={{
                    width: "100%",
                    height: 52,
                    background: isSelected ? "rgba(0, 201, 124, 0.063)" : "#13131A",
                    border: `1px solid ${isSelected ? "#00C97C" : "#2A2A38"}`,
                    borderRadius: 8,
                    padding: "0 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: isSelected ? "#00C97C" : "#F1F1F5",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s, color 0.15s",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      const el = e.currentTarget;
                      el.style.borderColor = "#3D3D52";
                      el.style.background = "#1C1C26";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      const el = e.currentTarget;
                      el.style.borderColor = "#2A2A38";
                      el.style.background = "#13131A";
                    }
                  }}
                >
                  <span>{option}</span>
                  {isSelected && (
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#00C97C",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Progress hint */}
          <p
            style={{
              fontSize: 12,
              color: "#52526B",
              textAlign: "center",
              marginTop: 24,
            }}
          >
            {currentQ + 1} / {QUESTIONS.length}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
