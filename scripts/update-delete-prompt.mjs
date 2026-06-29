/**
 * Atualiza a seção deletar_item do brain_system no Supabase.
 * Uso: node scripts/update-delete-prompt.mjs
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const envContent = readFileSync(envPath, 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => {
    const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
  })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data } = await supabase.from('prompts').select('content').eq('name', 'brain_system').single();
if (!data) { console.error('Prompt brain_system não encontrado'); process.exit(1); }

const oldSection = `### deletar_item
dados: { "tipo": "task"|"lead"|"project"|"financial", "busca_titulo": string }
Quando Roberto quer deletar algo: "deleta tarefa X", "remove o lead Y", "apaga o projeto Z", etc.`;

const newSection = `### deletar_item
dados: { "tipo": "task"|"lead"|"project"|"financial" | null, "busca_titulo": string }
Gatilhos: "deleta", "remova", "remove", "apaga", "exclui". Processe APENAS UM item por intent.
Se o usuário pedir para deletar múltiplos itens, use resposta_simples pedindo para fazer um de cada vez.
Se o tipo não for mencionado explicitamente, deixe tipo = null (o sistema busca em todos os tipos).`;

if (!data.content.includes('### deletar_item')) {
  console.error('Seção deletar_item não encontrada no prompt. Pode ter sido editada manualmente.');
  process.exit(1);
}

const newContent = data.content.replace(oldSection, newSection);

if (newContent === data.content) {
  console.log('Prompt já está atualizado ou seção com texto diferente. Nenhuma alteração feita.');
  process.exit(0);
}

const { error } = await supabase.from('prompts').update({ content: newContent, updated_at: new Date().toISOString() }).eq('name', 'brain_system');
if (error) { console.error('Erro ao atualizar:', error.message); process.exit(1); }

console.log('✓ Prompt brain_system atualizado com sucesso.');
