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

// Substitui a seção deletar_item — normaliza line endings antes
const content = data.content.replace(/\r\n/g, '\n');

const OLD = `### deletar_item
dados: { "tipo": "task"|"lead"|"project"|"financial", "busca_titulo": string }
Quando Roberto quer deletar algo: "deleta tarefa X", "remove o lead Y", "apaga o projeto Z", etc.`;

const NEW = `### deletar_item
dados: { "tipo": "task"|"lead"|"project"|"financial" | null, "busca_titulo": string }
Gatilhos: "deleta", "remova", "remove", "apaga", "exclui". Processe APENAS UM item por intent.
Se o usuario pedir para deletar multiplos itens, use resposta_simples pedindo para fazer um de cada vez.
Se o tipo nao for mencionado, deixe tipo = null (o sistema busca em todos os tipos automaticamente).`;

const newContent = content.replace(OLD, NEW);
if (newContent === content) { console.log('Secao nao encontrada — pode ja estar atualizada.'); process.exit(0); }

const { error } = await sb.from('prompts').update({ content: newContent, updated_at: new Date().toISOString() }).eq('name', 'brain_system');
console.log(error ? `ERRO: ${error.message}` : '✓ Prompt brain_system atualizado.');
