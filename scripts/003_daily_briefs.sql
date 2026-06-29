-- ============================================================
-- Briefings Diários — Supabase Migration
-- Controla quais mensagens programadas já foram enviadas hoje.
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_briefings (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone    TEXT NOT NULL,
  -- Chave composta: tipo + data (+ task_id para task_check)
  -- Exemplos: "manha_2026-06-29", "task_check_2026-06-29_<uuid>"
  ref_key  TEXT NOT NULL,
  sent_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (phone, ref_key)
);

-- Índice para limpeza periódica por data
CREATE INDEX IF NOT EXISTS daily_briefings_sent_idx ON daily_briefings (sent_at);
