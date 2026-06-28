/**
 * Seed dos prompts no Supabase.
 * Pré-requisito: execute o SQL de DDL primeiro (ver instruções abaixo).
 *
 * Uso: node scripts/run-migration.mjs
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Lê as variáveis do .env.local
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envContent = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrado em .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ─── Verifica se as tabelas existem ──────────────────────────────────────────

async function tabelaExiste(nome) {
  const { error } = await supabase.from(nome).select('*').limit(0);
  if (!error) return true;
  // PGRST116 = "results contain 0 rows" mas a tabela existe
  if (error.code === 'PGRST116') return true;
  return false;
}

// ─── Conteúdo dos prompts ─────────────────────────────────────────────────────

const sqlPath = new URL('./001_brain_refactor.sql', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const sql = readFileSync(sqlPath, 'utf-8');

function extrairPrompts(sqlContent) {
  const taggedBlocks = [
    { tag: 'BRAIN', name: 'brain_system' },
    { tag: 'HELENA', name: 'helena_sdr' },
    { tag: 'MARC1', name: 'marcenaria_analise' },
    { tag: 'MARC2', name: 'marcenaria_revisao' },
  ];

  const prompts = [];
  for (const { tag, name } of taggedBlocks) {
    const regex = new RegExp(`\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$`, 'g');
    const match = regex.exec(sqlContent);
    if (match) {
      prompts.push({ name, content: match[1] });
    }
  }
  return prompts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ddlSQL = `CREATE TABLE IF NOT EXISTS prompts (
  name       TEXT PRIMARY KEY,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_actions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  type       TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pending_actions_phone_type_idx ON pending_actions (phone, type);`;

const promptsOk = await tabelaExiste('prompts');
const pendingOk = await tabelaExiste('pending_actions');

if (!promptsOk || !pendingOk) {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  AÇÃO NECESSÁRIA: Criar tabelas no Supabase SQL Editor');
  console.log('══════════════════════════════════════════════════════════');
  console.log('\n1. Acesse: https://supabase.com/dashboard/project/qiwwczxaowgdkgbowxub/sql/new');
  console.log('\n2. Cole e execute este SQL:\n');
  console.log('─────────────────────────────────────────────────────────');
  console.log(ddlSQL);
  console.log('─────────────────────────────────────────────────────────');
  console.log('\n3. Depois execute este script novamente:');
  console.log('   node scripts/run-migration.mjs\n');
  process.exit(0);
}

console.log('✓ Tabelas encontradas. Fazendo seed dos prompts...\n');

const prompts = extrairPrompts(sql);
let inseridos = 0;
let ignorados = 0;

for (const { name, content } of prompts) {
  const { error } = await supabase.from('prompts').insert({ name, content });

  if (error) {
    if (error.code === '23505') {
      console.log(`  → "${name}" já existe, ignorado.`);
      ignorados++;
    } else {
      console.error(`  ✗ Erro ao inserir "${name}":`, error.message);
    }
  } else {
    console.log(`  ✓ Inserido: "${name}"`);
    inseridos++;
  }
}

console.log(`\n✓ Seed concluído: ${inseridos} inserido(s), ${ignorados} já existia(m).`);
if (inseridos > 0 || ignorados > 0) {
  console.log('\nSistema pronto! Faça o deploy no Railway para ativar as mudanças.');
}
