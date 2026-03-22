-- Migration 006: tutor_conversations
-- Persists AI Tutor chat history to the database so conversations
-- sync across devices. Each row stores the full message array as JSONB.

CREATE TABLE IF NOT EXISTS public.tutor_conversations (
  id          TEXT        PRIMARY KEY,                          -- client-generated e.g. "conv-1234567890"
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'New conversation',
  messages    JSONB       NOT NULL DEFAULT '[]',
  mode        TEXT        NOT NULL DEFAULT 'socratic' CHECK (mode IN ('socratic', 'direct')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_conversations_user
  ON public.tutor_conversations (user_id, updated_at DESC);

-- RLS
ALTER TABLE public.tutor_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tutor conversations"
  ON public.tutor_conversations
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
