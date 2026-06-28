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

const content = data.content.replace(/\r\n/g, '\n');

const OLD = `## Formato de resposta OBRIGATÓRIO
Sempre responda APENAS com JSON válido, sem texto antes ou depois:

{
  "intent": "<tipo>",
  "dados": { ... },
  "resposta": "<texto natural em português para enviar ao Roberto no WhatsApp>"
}`;

const NEW = `## Formato de resposta OBRIGATÓRIO
Sempre responda APENAS com JSON válido, sem texto antes ou depois.
- Ação única: { "intent": "<tipo>", "dados": { ... }, "resposta": "<texto>" }
- Múltiplas ações (ex: "adiciona tarefa X e Y", "anota A, B e C"):
  [ { "intent": "...", "dados": { ... }, "resposta": "" }, { "intent": "...", "dados": { ... }, "resposta": "" } ]
  No array, deixe "resposta" vazio — o sistema gera a confirmação automaticamente.`;

const newContent = content.replace(OLD, NEW);
if (newContent === content) {
  console.log('Secao nao encontrada no prompt do DB — pode ja estar atualizada ou com texto diferente.');
  console.log('Atualizando por append manual...');

  // Fallback: replace the entire format section using a broader match
  const fallbackOld = /## Formato de resposta OBRIGATÓRIO[\s\S]*?(?=\n## Tipos de intent)/;
  const fallbackNew = `## Formato de resposta OBRIGATÓRIO
Sempre responda APENAS com JSON válido, sem texto antes ou depois.
- Ação única: { "intent": "<tipo>", "dados": { ... }, "resposta": "<texto>" }
- Múltiplas ações (ex: "adiciona tarefa X e Y", "anota A, B e C"):
  [ { "intent": "...", "dados": { ... }, "resposta": "" }, { "intent": "...", "dados": { ... }, "resposta": "" } ]
  No array, deixe "resposta" vazio — o sistema gera a confirmação automaticamente.

`;
  const nc2 = content.replace(fallbackOld, fallbackNew);
  if (nc2 === content) { console.log('Fallback também falhou. Edite manualmente via "prompt editar 1".'); process.exit(0); }

  const { error } = await sb.from('prompts').update({ content: nc2, updated_at: new Date().toISOString() }).eq('name', 'brain_system');
  console.log(error ? `ERRO: ${error.message}` : '✓ Prompt atualizado via fallback.');
  process.exit(0);
}

const { error } = await sb.from('prompts').update({ content: newContent, updated_at: new Date().toISOString() }).eq('name', 'brain_system');
console.log(error ? `ERRO: ${error.message}` : '✓ Prompt brain_system atualizado com suporte a múltiplos intents.');
