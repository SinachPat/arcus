-- Migration 009: Add flagged column to user_question_history
-- Required by mock exam submit (stores flagged state) and getResults (reads it)

ALTER TABLE public.user_question_history
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
