import { create } from "zustand";

export interface MockQuestion {
  id: string;
  domainId: string;
  type: string;
  content: string;
  difficulty: number;
  options: Array<{ id: string; text: string }>;
}

interface MockExamState {
  // Session metadata
  sessionId: string | null;
  mode: "full" | "half" | "quick" | null;
  timeLimitSeconds: number;
  startedAt: string | null; // ISO string — used to compute elapsed via Date.now()

  // Exam content
  questions: MockQuestion[];

  // User state
  answers: Record<string, string[]>; // questionId -> selectedOptionIds
  flags: string[]; // array of flagged questionIds (Set serializes poorly in JSON)
  currentIndex: number;
  submitted: boolean;

  // Actions
  initSession(
    sessionId: string,
    mode: "full" | "half" | "quick",
    timeLimitSeconds: number,
    questions: MockQuestion[]
  ): void;
  setAnswer(questionId: string, optionIds: string[]): void;
  toggleFlag(questionId: string): void;
  setCurrentIndex(index: number): void;
  markSubmitted(): void;
  restore(sessionId: string): boolean;
  persist(): void;
  reset(): void;
}

export const useMockExamStore = create<MockExamState>((set, get) => ({
  sessionId: null,
  mode: null,
  timeLimitSeconds: 0,
  startedAt: null,
  questions: [],
  answers: {},
  flags: [],
  currentIndex: 0,
  submitted: false,

  initSession(sessionId, mode, timeLimitSeconds, questions) {
    set({
      sessionId,
      mode,
      timeLimitSeconds,
      startedAt: new Date().toISOString(),
      questions,
      answers: {},
      flags: [],
      currentIndex: 0,
      submitted: false,
    });
    get().persist();
  },

  setAnswer(questionId, optionIds) {
    set((s) => ({ answers: { ...s.answers, [questionId]: optionIds } }));
    get().persist();
  },

  toggleFlag(questionId) {
    set((s) => {
      const alreadyFlagged = s.flags.includes(questionId);
      return {
        flags: alreadyFlagged
          ? s.flags.filter((id) => id !== questionId)
          : [...s.flags, questionId],
      };
    });
    get().persist();
  },

  setCurrentIndex(index) {
    set({ currentIndex: index });
  },

  markSubmitted() {
    set({ submitted: true });
    get().persist();
  },

  persist() {
    const s = get();
    if (!s.sessionId) return;
    try {
      const snapshot = {
        sessionId: s.sessionId,
        mode: s.mode,
        timeLimitSeconds: s.timeLimitSeconds,
        startedAt: s.startedAt,
        questions: s.questions,
        answers: s.answers,
        flags: s.flags,
        currentIndex: s.currentIndex,
        submitted: s.submitted,
      };
      localStorage.setItem("arcus_mock_" + s.sessionId, JSON.stringify(snapshot));
    } catch {
      // localStorage may be unavailable (SSR, private browsing quota)
    }
  },

  restore(sessionId) {
    try {
      const raw = localStorage.getItem("arcus_mock_" + sessionId);
      if (!raw) return false;
      const snapshot = JSON.parse(raw) as Partial<MockExamState>;
      set({
        sessionId: snapshot.sessionId ?? null,
        mode: snapshot.mode ?? null,
        timeLimitSeconds: snapshot.timeLimitSeconds ?? 0,
        startedAt: snapshot.startedAt ?? null,
        questions: snapshot.questions ?? [],
        answers: snapshot.answers ?? {},
        flags: snapshot.flags ?? [],
        currentIndex: snapshot.currentIndex ?? 0,
        submitted: snapshot.submitted ?? false,
      });
      return true;
    } catch {
      return false;
    }
  },

  reset() {
    set({
      sessionId: null,
      mode: null,
      timeLimitSeconds: 0,
      startedAt: null,
      questions: [],
      answers: {},
      flags: [],
      currentIndex: 0,
      submitted: false,
    });
  },
}));
