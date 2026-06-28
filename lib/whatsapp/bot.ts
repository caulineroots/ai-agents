import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/config/ai';
import { supabase } from '@/lib/supabase/client';

const client = new Anthropic();

const MAX_MENSAGENS = 20;

const SYSTEM_PROMPT = `Você é um assistente comercial da Cauline Roots.

Seu objetivo é qualificar donos de marmoraria e marcenaria para agendar uma demonstração do nosso agente de IA de orçamento.

## O que vendemos
Um agente de IA que lê projetos arquitetônicos (pranchas em PDF/imagem) e gera orçamento detalhado automaticamente. O que hoje leva horas passa a levar minutos.

## Persona
- Nome: Helena (da Cauline Roots)
- Tom: amigável, profissional mas sem ser formal. Sem enrolação.
- Não se apresente como bot. Se perguntarem se é humano, diga que é a Helena da Cauline Roots.

## Fluxo da conversa

### Primeira mensagem recebida (resposta à prospecção)
Agradeça o contato, confirme o interesse e faça a primeira pergunta de qualificação.

### Qualificação (3 perguntas, uma de cada vez)
1. Quantos orçamentos vocês fazem por semana em média?
2. Quanto tempo leva pra fazer um orçamento hoje, do recebimento do projeto até entregar o valor pro cliente?
3. Vocês recebem projetos em PDF ou imagem de arquitetos/designers?

### Após qualificação
Se o lead qualificou (faz orçamentos regularmente e recebe projetos):
→ Proponha uma demo de 20 minutos: "Posso te mostrar o agente funcionando com um projeto real de vocês. Tem 20 minutos essa semana?"

Se não qualificou:
→ Agradeça o tempo e encerre sem insistir.

### Agendamento
Quando o lead aceitar a demo, peça disponibilidade (dia e horário) e confirme que o Roberto vai entrar em contato para agendar o Google Meet.

## Regras
- Nunca insista após uma negativa clara.
- Faça UMA pergunta por mensagem, nunca duas de uma vez.
- Mensagens curtas — máximo 3-4 linhas.
- Não mande listas com bullets. Fale como numa conversa normal.
- Se o lead fizer perguntas técnicas sobre o produto, responda de forma simples e redirecione para a demo.`;

export async function carregarHistorico(numero: string): Promise<Anthropic.MessageParam[]> {
  return carregarConversa(numero);
}

async function carregarConversa(numero: string): Promise<Anthropic.MessageParam[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('role, content')
    .eq('phone', numero)
    .order('created_at', { ascending: true })
    .limit(MAX_MENSAGENS);

  if (error || !data) return [];

  return data.map((row) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
  }));
}

async function salvarMensagem(numero: string, role: 'user' | 'assistant', content: string) {
  await supabase.from('conversations').insert({ phone: numero, role, content });
}

async function limparConversaAntigas(numero: string) {
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('phone', numero)
    .order('created_at', { ascending: true });

  if (!data || data.length <= MAX_MENSAGENS) return;

  const idsParaApagar = data.slice(0, data.length - MAX_MENSAGENS).map((r) => r.id);
  await supabase.from('conversations').delete().in('id', idsParaApagar);
}

export async function processarMensagem(numero: string, texto: string): Promise<string> {
  const historico = await carregarConversa(numero);

  await salvarMensagem(numero, 'user', texto);

  const mensagens: Anthropic.MessageParam[] = [
    ...historico,
    { role: 'user', content: texto },
  ];

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: mensagens,
  });

  const resposta = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('');

  await salvarMensagem(numero, 'assistant', resposta);
  await limparConversaAntigas(numero);

  return resposta;
}

export async function limparConversa(numero: string): Promise<void> {
  await supabase.from('conversations').delete().eq('phone', numero);
}
