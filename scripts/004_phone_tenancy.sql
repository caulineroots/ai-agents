-- Multi-tenancy por número de WhatsApp
-- Cada registro vault_documents fica isolado pelo phone do remetente

ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS idx_vault_documents_phone ON vault_documents(phone);

-- Backfill: rode manualmente substituindo pelo seu número (sem +, ex: 5511999887766)
-- UPDATE vault_documents SET phone = 'SEU_NUMERO' WHERE phone IS NULL;

-- Tabela de tokens temporários para magic link do dashboard
CREATE TABLE IF NOT EXISTS dashboard_tokens (
  token      TEXT PRIMARY KEY,
  phone      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove tokens expirados automaticamente (limpeza periódica via cron)
CREATE INDEX IF NOT EXISTS idx_dashboard_tokens_expires ON dashboard_tokens(expires_at);
