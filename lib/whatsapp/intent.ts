/**
 * AI Brain — detecta a intenção do dono do negócio (Roberto) e age no vault.
 * Usado quando o remetente é o OWNER_PHONE configurado em .env.local.
 */

import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/config/ai';
import {
  listar,
  criarTarefa,
  criarLead,
  criarProjeto,
  criarFinanceiro,
  formatarTarefas,
  formatarLeads,
  formatarProjetos,
  formatarFinanceiro,
  type VaultDocument,
} from './vault';
import { criarEventoCalendar } from './calendar';

const client = new Anthropic();

// ─── Tipos de intenção ────────────────────────────────────────────────────────

type IntentType =
  | 'criar_tarefa'
  | 'criar_lead'
  | 'criar_projeto'
  | 'criar_financeiro'
  | 'listar_tarefas'
  | 'listar_leads'
  | 'listar_projetos'
  | 'listar_financeiro'
  | 'resposta_simples';

interface IntentResult {
  intent: IntentType;
  dados: Record<string, unknown>;
  resposta: string;
}

// ─── System prompt do Brain (gerado em runtime para datas corretas) ───────────

function getBrainSystem(): string {
  const DIAS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  // Usa horário de Brasília (UTC-3)
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = agora.toISOString().slice(0, 10);
  const diaSemanaHoje = agora.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const diaHojeNome = DIAS_PT[diaSemanaHoje];

  // Calcula os próximos 7 dias com nome e data
  const proximosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(agora);
    d.setDate(agora.getDate() + i + 1);
    const iso = d.toISOString().slice(0, 10);
    const diaSem = d.getDay();
    return `${DIAS_CURTO[diaSem]} ${iso}  (${DIAS_PT[diaSem]})`;
  }).join('\n');

  return `Você é o assistente pessoal de Roberto, sócio da Cauline Roots (startup de agentes de IA para marmoraria e marcenaria).

Seu papel: entender o que Roberto quer fazer e responder com um JSON contendo a ação e os dados extraídos da mensagem.

## Contexto do negócio
- Cauline Roots desenvolve agentes de IA para marmoraria e marcenaria
- Clientes/prospects: donos de marmoraria, marcenaria, construtoras
- Projetos ativos: agente de orçamento de marmoraria, agente de orçamento de marcenaria, Celmar (construtora)
- Sócios: Roberto (criativo, vendas, operação) e Kevin (investidor, dev)

## Referência de datas (OBRIGATÓRIO usar essa tabela)
Hoje: ${hoje} (${diaHojeNome})
Próximos dias:
${proximosDias}

Regras de data:
- "amanhã" = primeiro dia da tabela acima
- "segunda", "segunda-feira" = a PRIMEIRA segunda-feira da tabela acima
- "terça", "quarta", "quinta", "sexta", "sábado", "domingo" = o primeiro dia correspondente na tabela
- "semana que vem" ou "próxima semana" = a segunda-feira 7+ dias à frente
- Se não mencionar data, prazo = null

## Formato de resposta OBRIGATÓRIO
Sempre responda APENAS com JSON válido, sem texto antes ou depois:

{
  "intent": "<tipo>",
  "dados": { ... },
  "resposta": "<texto natural em português para enviar ao Roberto no WhatsApp>"
}

## Tipos de intent disponíveis

### criar_tarefa
dados: { "titulo": string, "prazo": "YYYY-MM-DD" | null, "urgencia": "baixa"|"media"|"alta", "descricao": string | null }
Quando Roberto diz: "adiciona tarefa", "lembra de", "preciso", "não esquece de", "task:", etc.

### criar_lead
dados: { "nome": string, "empresa": string | null, "telefone": string | null, "interesse": string | null }
Quando Roberto registra um novo contato comercial: "novo lead", "conheci alguém", "cliente potencial", etc.

### criar_projeto
dados: { "nome": string, "cliente": string | null, "status": "ativo"|"pausado"|"concluido", "valor_estimado": number | null }
Quando Roberto fala de um novo projeto ou cliente confirmado.

### criar_financeiro
dados: { "descricao": string, "valor": number, "tipo": "receita"|"despesa", "projeto": string | null }
Quando Roberto registra entrada ou saída: "recebi", "paguei", "gastei", "entrada de", "despesa de", etc.

### listar_tarefas
dados: { "status": "pendente"|"em_andamento"|"concluida" | null, "urgencia": "alta"|"media"|"baixa" | null }
Quando Roberto pergunta sobre tarefas: "o que tenho pra fazer", "minhas tarefas", "lista de tarefas", etc.

### listar_leads
dados: { "status": string | null }
Quando Roberto pergunta sobre leads: "meus leads", "prospects", "lista de contatos", etc.

### listar_projetos
dados: {}
Quando Roberto pergunta sobre projetos: "projetos ativos", "status dos projetos", etc.

### listar_financeiro
dados: {}
Quando Roberto pergunta sobre financeiro: "como está o financeiro", "entradas e saídas", "saldo", etc.

### resposta_simples
dados: {}
Para qualquer outra mensagem: perguntas gerais, conversas, dúvidas sem ação de vault.
resposta: resposta natural e útil.

## Regras gerais
- Valores monetários: extraia apenas o número (ex: "R$500" → 500, "1.200 reais" → 1200)
- Se a mensagem for ambígua, use intent=resposta_simples e pergunte para clarificar
- A "resposta" deve ser curta (2-3 linhas máximo), confirmando a ação ou respondendo a pergunta
- NUNCA use markdown (negrito, listas, etc.) na resposta — é para WhatsApp, texto puro`;
}

// ─── Parser de intent ─────────────────────────────────────────────────────────

async function detectarIntent(
  historico: Anthropic.MessageParam[],
  mensagem: string,
): Promise<IntentResult | null> {
  const messages: Anthropic.MessageParam[] = [
    ...historico.slice(-6), // apenas as últimas 3 trocas para contexto
    { role: 'user', content: mensagem },
  ];

  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: getBrainSystem(),
    messages,
  });

  const raw = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('');

  try {
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    return JSON.parse(jsonStr) as IntentResult;
  } catch {
    console.error('[intent] falha ao parsear JSON:', raw.slice(0, 500));
    return null;
  }
}

// ─── Executor de intenções ────────────────────────────────────────────────────

async function executarIntent(result: IntentResult): Promise<string> {
  const { intent, dados, resposta } = result;

  switch (intent) {
    case 'criar_tarefa': {
      const doc = await criarTarefa(dados.titulo as string, {
        prazo: (dados.prazo as string) ?? undefined,
        urgencia: (dados.urgencia as 'baixa' | 'media' | 'alta') ?? 'media',
        descricao: (dados.descricao as string) ?? undefined,
      });

      // Se tem prazo, tenta criar evento no Google Calendar
      if (doc && dados.prazo) {
        try {
          const eventId = await criarEventoCalendar(
            `[Tarefa] ${dados.titulo as string}`,
            dados.prazo as string,
            (dados.descricao as string) ?? '',
          );
          if (eventId) {
            await import('./vault').then(({ atualizar }) =>
              atualizar(doc.id, {
                metadata: { ...doc.metadata, calendar_event_id: eventId },
              }),
            );
          }
        } catch { /* calendar é opcional */ }
      }

      return resposta;
    }

    case 'criar_lead': {
      await criarLead(dados.nome as string, {
        empresa: (dados.empresa as string) ?? undefined,
        telefone: (dados.telefone as string) ?? undefined,
        interesse: (dados.interesse as string) ?? undefined,
      });
      return resposta;
    }

    case 'criar_projeto': {
      await criarProjeto(dados.nome as string, {
        cliente: (dados.cliente as string) ?? undefined,
        status: (dados.status as 'ativo' | 'pausado' | 'concluido') ?? 'ativo',
        valor_estimado: (dados.valor_estimado as number) ?? undefined,
      });
      return resposta;
    }

    case 'criar_financeiro': {
      await criarFinanceiro(dados.descricao as string, {
        valor: dados.valor as number,
        tipo: dados.tipo as 'receita' | 'despesa',
        projeto: (dados.projeto as string) ?? undefined,
      });
      return resposta;
    }

    case 'listar_tarefas': {
      const filtros: Record<string, unknown> = {};
      if (dados.status) filtros.status = dados.status;
      if (dados.urgencia) filtros.urgencia = dados.urgencia;
      const docs = await listar('task', Object.keys(filtros).length ? filtros : undefined, 15);
      const lista = formatarTarefas(docs);
      return `Tarefas:\n${lista}`;
    }

    case 'listar_leads': {
      const filtros: Record<string, unknown> = {};
      if (dados.status) filtros.status = dados.status;
      const docs = await listar('lead', Object.keys(filtros).length ? filtros : undefined, 15);
      const lista = formatarLeads(docs);
      return `Leads:\n${lista}`;
    }

    case 'listar_projetos': {
      const docs = await listar('project', undefined, 10);
      const lista = formatarProjetos(docs);
      return `Projetos:\n${lista}`;
    }

    case 'listar_financeiro': {
      const docs = await listar('financial', undefined, 20);
      const lista = formatarFinanceiro(docs);
      return `Financeiro:\n${lista}`;
    }

    case 'resposta_simples':
    default:
      return resposta;
  }
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function processarComBrain(
  historico: Anthropic.MessageParam[],
  mensagem: string,
): Promise<string> {
  try {
    const result = await detectarIntent(historico, mensagem);
    if (!result) {
      return 'Não entendi bem. Pode reformular?';
    }
    return await executarIntent(result);
  } catch (err) {
    console.error('[brain] erro:', err);
    return 'Erro interno no assistente. Tenta de novo.';
  }
}

// Helper para listar documentos de um tipo com formatação (usado pelo vault.ts)
export async function listarFormatado(type: 'task' | 'lead' | 'project' | 'financial'): Promise<string> {
  const docs = await listar(type, undefined, 20);
  switch (type) {
    case 'task': return formatarTarefas(docs);
    case 'lead': return formatarLeads(docs);
    case 'project': return formatarProjetos(docs);
    case 'financial': return formatarFinanceiro(docs);
  }
}
