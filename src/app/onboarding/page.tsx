"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ProgressBar from "@/components/onboarding/ProgressBar";
import ExamSelection from "@/components/onboarding/ExamSelection";
import SelfAssessment from "@/components/onboarding/SelfAssessment";
import DiagnosticQuiz from "@/components/onboarding/DiagnosticQuiz";
import ResultsStudyPlan from "@/components/onboarding/ResultsStudyPlan";
import GamificationTutorial from "@/components/onboarding/GamificationTutorial";

const TOTAL_STEPS = 5;

/** Self-assessment answers collected in Step 2. */
export interface SelfAssessmentData {
  experience:      string;
  productionUsage: string;
  priorAttempt:    string;
  targetDate:      string;
  studyHours:      string;
}

/** Shared wizard state passed between steps. */
export interface WizardState {
  examId:         string | null;
  selfAssessment: SelfAssessmentData | null;
  diagnosticResults: {
    readinessScore: number;
    domainScores:   Record<string, number>;
    sessionId:      string | null;
    xpEarned:       number;
  } | null;
  studyPlan: {
    estimatedDaysToReadiness: number;
    weeklyPlan: Array<{
      weekNumber:   number;
      focusDomains: string[];
      dailyMinutes: number;
      goals:        string[];
    }>;
    priorityDomains: string[];
  } | null;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>({
    examId:            null,
    selfAssessment:    null,
    diagnosticResults: null,
    studyPlan:         null,
  });

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, TOTAL_STEPS)), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const updateWizard = useCallback(
    (partial: Partial<WizardState>) => setWizard((prev) => ({ ...prev, ...partial })),
    []
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-geist-sans)",
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
        }}
      >
        <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {step > 1 && step < 4 && (
            <button
              onClick={goBack}
              style={{
                background: "transparent",
                border: "none",
                color: "#8B8BA7",
                fontSize: 13,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Back
            </button>
          )}
        </div>
      </div>

      {/* ── Content zone ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0 24px",
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", maxWidth: 560 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              {step === 1 && (
                <ExamSelection
                  onNext={goNext}
                  onSelect={(examId) => updateWizard({ examId })}
                />
              )}
              {step === 2 && (
                <SelfAssessment
                  onNext={goNext}
                  onComplete={(data) => updateWizard({ selfAssessment: data })}
                />
              )}
              {step === 3 && (
                <DiagnosticQuiz
                  examId={wizard.examId!}
                  onNext={goNext}
                  onResults={(results) => updateWizard({ diagnosticResults: results })}
                />
              )}
              {step === 4 && (
                <ResultsStudyPlan
                  examId={wizard.examId!}
                  diagnosticResults={wizard.diagnosticResults!}
                  selfAssessment={wizard.selfAssessment!}
                  onNext={goNext}
                  onPlanGenerated={(plan) => updateWizard({ studyPlan: plan })}
                />
              )}
              {step === 5 && <GamificationTutorial />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
