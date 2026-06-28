/**
 * Atualiza o brain_system no Supabase para incluir:
 * - prazo_hora no criar_tarefa
 * - intents listar_lembretes e cancelar_lembrete
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await sb.from('prompts').select('content').eq('name', 'brain_system').single();
if (!data) { console.error('Prompt não encontrado'); process.exit(1); }

let content = data.content.replace(/\r\n/g, '\n');

// 1. Atualiza a lista de tipos disponíveis (adiciona listar_lembretes e cancelar_lembrete)
content = content.replace(
  /criar_tarefa \| criar_lead \| criar_projeto \| criar_financeiro \| listar_tarefas \| listar_leads \| listar_projetos \| listar_financeiro \| deletar_item \| resposta_simples/,
  'criar_tarefa | criar_lead | criar_projeto | criar_financeiro | listar_tarefas | listar_leads | listar_projetos | listar_financeiro | deletar_item | listar_lembretes | cancelar_lembrete | resposta_simples'
);

// 2. Atualiza a definição de criar_tarefa para incluir prazo_hora
content = content.replace(
  /### criar_tarefa — dados: \{ titulo, prazo, urgencia, descricao \}/,
  '### criar_tarefa — dados: { titulo, prazo, prazo_hora, urgencia, descricao }\nprazo: ISO date "YYYY-MM-DD" | null. prazo_hora: "HH:MM" (24h) | null — extraia de "às 10h" → "10:00", "às 14h30" → "14:30".'
);

// 3. Adiciona definições dos novos intents após deletar_item
const DELETAR_BLOCO = /### deletar_item.*?(?=\n###|\n## )/s;
const match = content.match(DELETAR_BLOCO);
if (match) {
  const apos = match[0];
  content = content.replace(apos, apos + '\n### listar_lembretes — dados: {} — Gatilhos: "lembretes", "meus lembretes", "que lembretes tenho"\n### cancelar_lembrete — dados: { busca_titulo: string | null } — Cancela lembretes de uma tarefa (ou todos se busca_titulo = null). Gatilhos: "cancela lembrete", "remove lembrete", "apaga lembrete"');
}

const { error } = await sb.from('prompts').update({ content, updated_at: new Date().toISOString() }).eq('name', 'brain_system');
console.log(error ? `ERRO: ${error.message}` : '✓ Prompt brain_system atualizado com suporte a lembretes.');
