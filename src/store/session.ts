import { create } from "zustand";
import type { ActiveSession, SessionQuestion, QuestionState, TutorContext } from "@/types";

interface SessionStore {
  session: ActiveSession | null;

  // AI Tutor context — set when navigating from a wrong answer
  tutorContext: TutorContext | null;
  setTutorContext: (ctx: TutorContext | null) => void;

  // Lifecycle
  startSession:  (session: ActiveSession)                         => void;
  endSession:    ()                                               => void;

  // Navigation
  setCurrentIndex: (index: number)                               => void;
  goToNext:        ()                                             => void;
  goToPrev:        ()                                             => void;

  // Question state
  setQuestionState: (questionId: string, state: QuestionState)   => void;
  toggleFlag:       (questionId: string)                         => void;

  // Derived helpers
  currentQuestion: () => SessionQuestion | null;
  answeredCount:   () => number;
  flaggedCount:    () => number;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  tutorContext: null,
  setTutorContext: (ctx) => set({ tutorContext: ctx }),

  startSession: (session) => set({ session }),

  endSession: () => set({ session: null }),

  setCurrentIndex: (index) =>
    set((s) => {
      if (!s.session) return s;
      return { session: { ...s.session, currentIndex: index } };
    }),

  goToNext: () =>
    set((s) => {
      if (!s.session) return s;
      const next = Math.min(s.session.currentIndex + 1, s.session.questions.length - 1);
      return { session: { ...s.session, currentIndex: next } };
    }),

  goToPrev: () =>
    set((s) => {
      if (!s.session) return s;
      const prev = Math.max(s.session.currentIndex - 1, 0);
      return { session: { ...s.session, currentIndex: prev } };
    }),

  setQuestionState: (questionId, state) =>
    set((s) => {
      if (!s.session) return s;
      return {
        session: {
          ...s.session,
          questions: s.session.questions.map((q) =>
            q.id === questionId ? { ...q, state } : q
          ),
        },
      };
    }),

  toggleFlag: (questionId) =>
    set((s) => {
      if (!s.session) return s;
      return {
        session: {
          ...s.session,
          questions: s.session.questions.map((q) =>
            q.id === questionId ? { ...q, flagged: !q.flagged } : q
          ),
        },
      };
    }),

  currentQuestion: () => {
    const { session } = get();
    if (!session) return null;
    return session.questions[session.currentIndex] ?? null;
  },

  answeredCount: () => {
    const { session } = get();
    if (!session) return 0;
    return session.questions.filter((q) => q.state?.isSubmitted).length;
  },

  flaggedCount: () => {
    const { session } = get();
    if (!session) return 0;
    return session.questions.filter((q) => q.flagged).length;
  },
}));
