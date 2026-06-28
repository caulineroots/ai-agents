-- ============================================================
-- Sistema de Lembretes — Supabase Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_document_id UUID REFERENCES vault_documents(id) ON DELETE CASCADE,
  phone             TEXT NOT NULL,
  send_at           TIMESTAMPTZ NOT NULL,
  offset_label      TEXT NOT NULL,  -- '24h', '12h', '6h', '2h', '1h', '30m', '10m', '2m', 'manha'
  sent              BOOLEAN DEFAULT FALSE,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para o cron: só busca não enviados com send_at vencido
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders (send_at, sent) WHERE NOT sent;
-- Índice para o agente listar lembretes por phone
CREATE INDEX IF NOT EXISTS reminders_phone_idx ON reminders (phone, sent, send_at);

-- Config de offsets (editável pelo agente via "prompt editar reminder_config")
INSERT INTO prompts (name, content) VALUES
('reminder_config', '{
  "offsets_com_hora": [-1440, -720, -360, -120, -60, -30, -10, -2],
  "offsets_sem_hora": [-1440, -60],
  "labels": {
    "-1440": "24h",
    "-720": "12h",
    "-360": "6h",
    "-120": "2h",
    "-60": "1h",
    "-30": "30m",
    "-10": "10m",
    "-2": "2m",
    "manha": "manha"
  }
}')
ON CONFLICT (name) DO NOTHING;
