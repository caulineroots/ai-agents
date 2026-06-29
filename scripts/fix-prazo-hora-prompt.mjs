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

let c = data.content.replace(/\r\n/g, '\n');

// 1. Atualiza criar_tarefa para incluir prazo_hora
c = c.replace(
  /### criar_tarefa[^\n]*/,
  '### criar_tarefa — dados: { titulo, prazo, prazo_hora, urgencia, descricao }\nprazo: ISO date YYYY-MM-DD ou null. prazo_hora: HH:MM em 24h ou null — extraia de "as 10h" -> "10:00", "7:53" -> "07:53", "14h30" -> "14:30".'
);

// 2. Adiciona novos intents na lista de tipos
c = c.replace(
  'deletar_item | resposta_simples',
  'deletar_item | listar_lembretes | cancelar_lembrete | resposta_simples'
);

// 3. Adiciona definições dos novos intents (só se ainda não existirem)
if (!c.includes('listar_lembretes')) {
  c = c.replace(
    '### listar_*',
    '### listar_lembretes — dados: {} — Gatilhos: lembretes, meus lembretes\n### cancelar_lembrete — dados: { busca_titulo } — cancela lembretes de uma tarefa. Gatilhos: cancela lembrete\n### listar_*'
  );
}

const { error } = await sb.from('prompts').update({ content: c, updated_at: new Date().toISOString() }).eq('name', 'brain_system');
if (error) {
  console.error('ERRO:', error.message);
} else {
  console.log('✓ Prompt atualizado');
  console.log('  prazo_hora:', c.includes('prazo_hora') ? 'SIM' : 'NAO');
  console.log('  listar_lembretes:', c.includes('listar_lembretes') ? 'SIM' : 'NAO');
  console.log('  cancelar_lembrete:', c.includes('cancelar_lembrete') ? 'SIM' : 'NAO');
}
