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
import { getPrompt } from './prompts-db';
import { criarPendingAction } from './pending-actions';
import { supabase } from '@/lib/supabase/client';

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
  | 'deletar_item'
  | 'resposta_simples';

interface IntentResult {
  intent: IntentType;
  dados: Record<string, unknown>;
  resposta: string;
}

// ─── System prompt do Brain (gerado em runtime para datas corretas) ───────────

export async function getBrainSystem(): Promise<string> {
  const DIAS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = agora.toISOString().slice(0, 10);
  const diaHojeNome = DIAS_PT[agora.getDay()];

  const proximosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(agora);
    d.setDate(agora.getDate() + i + 1);
    const iso = d.toISOString().slice(0, 10);
    const diaSem = d.getDay();
    return `${DIAS_CURTO[diaSem]} ${iso}  (${DIAS_PT[diaSem]})`;
  }).join('\n');

  const tabelaDatas = `Hoje: ${hoje} (${diaHojeNome})\nPróximos dias:\n${proximosDias}`;

  const template = await getPrompt('brain_system');

  if (!template) {
    // Fallback inline caso o DB ainda não tenha sido populado
    return buildFallbackPrompt(tabelaDatas);
  }

  return template.replace('{{DATA_BRASILIA}}', tabelaDatas);
}

function buildFallbackPrompt(tabelaDatas: string): string {
  return `Você é o assistente pessoal de Roberto, sócio da Cauline Roots (startup de agentes de IA para marmoraria e marcenaria).

Seu papel: entender o que Roberto quer fazer e responder com um JSON contendo a ação e os dados extraídos da mensagem.

## Ferramentas disponíveis
- SALVAR: tarefas, leads, projetos, financeiro — descreva e eu registro
- LISTAR: pergunte suas tarefas, leads, projetos ou financeiro
- DELETAR: "deleta a tarefa X" — dupla confirmação antes de executar
- PDF → ORÇAMENTO: envie PDF de marcenaria pelo WhatsApp, resultado aparece no PC
- GOOGLE CALENDAR: conecte via /calendar, cria eventos ao salvar tarefas com prazo
- PROMPTS: comando "prompt" → ver/editar prompts do sistema

## Referência de datas (OBRIGATÓRIO usar essa tabela)
${tabelaDatas}

Regras de data:
- "amanhã" = primeiro dia da tabela acima
- "semana que vem" = segunda-feira 7+ dias à frente
- Se não mencionar data, prazo = null

## Formato de resposta OBRIGATÓRIO
Sempre responda APENAS com JSON válido, sem texto antes ou depois:
{ "intent": "<tipo>", "dados": { ... }, "resposta": "<texto>" }

## Tipos: criar_tarefa | criar_lead | criar_projeto | criar_financeiro | listar_tarefas | listar_leads | listar_projetos | listar_financeiro | deletar_item | resposta_simples

### criar_tarefa — dados: { titulo, prazo, urgencia, descricao }
### criar_lead — dados: { nome, empresa, telefone, interesse }
### criar_projeto — dados: { nome, cliente, status, valor_estimado }
### criar_financeiro — dados: { descricao, valor, tipo, projeto }
### deletar_item — dados: { tipo: "task"|"lead"|"project"|"financial" | null, busca_titulo: string }
Gatilhos: "deleta", "remova", "remove", "apaga", "exclui". Processe APENAS UM item. Para múltiplos, use resposta_simples pedindo um de cada vez. Se o tipo não for mencionado, deixe tipo = null.
### listar_* — dados conforme tipo

## Regras gerais
- Valores monetários: extraia apenas o número (ex: "R$500" → 500)
- NUNCA use markdown na resposta — é para WhatsApp, texto puro`;
}

// ─── Parser de intent ─────────────────────────────────────────────────────────

async function detectarIntent(
  historico: Anthropic.MessageParam[],
  mensagem: string,
): Promise<IntentResult | null> {
  const systemPrompt = await getBrainSystem();

  const messages: Anthropic.MessageParam[] = [
    ...historico.slice(-6),
    { role: 'user', content: mensagem },
  ];

  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
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

async function executarIntent(result: IntentResult, phone: string): Promise<string> {
  const { intent, dados } = result;

  switch (intent) {
    case 'criar_tarefa': {
      const titulo = dados.titulo as string | null;
      if (!titulo?.trim()) {
        return 'Não consegui identificar o título da tarefa. Pode repetir com mais detalhes?';
      }

      const doc = await criarTarefa(titulo.trim(), {
        prazo: (dados.prazo as string) ?? undefined,
        urgencia: (dados.urgencia as 'baixa' | 'media' | 'alta') ?? 'media',
        descricao: (dados.descricao as string) ?? undefined,
      });

      if (!doc) {
        return 'Erro ao salvar a tarefa. Tenta de novo.';
      }

      if (doc && dados.prazo) {
        try {
          const eventId = await criarEventoCalendar(
            `[Tarefa] ${titulo}`,
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

      const prazoStr = dados.prazo ? (dados.prazo as string) : 'sem prazo';
      const urgenciaStr = (dados.urgencia as string) ?? 'media';
      return `✓ Tarefa salva\nTítulo: ${titulo}\nPrazo: ${prazoStr}\nUrgência: ${urgenciaStr}`;
    }

    case 'criar_lead': {
      const nome = dados.nome as string | null;
      if (!nome?.trim()) {
        return 'Não consegui identificar o nome do lead. Pode repetir?';
      }

      const doc = await criarLead(nome.trim(), {
        empresa: (dados.empresa as string) ?? undefined,
        telefone: (dados.telefone as string) ?? undefined,
        interesse: (dados.interesse as string) ?? undefined,
      });

      if (!doc) {
        return 'Erro ao salvar o lead. Tenta de novo.';
      }

      const empresaStr = dados.empresa ? ` (${dados.empresa as string})` : '';
      return `✓ Lead salvo\nNome: ${nome}${empresaStr}`;
    }

    case 'criar_projeto': {
      const nome = dados.nome as string | null;
      if (!nome?.trim()) {
        return 'Não consegui identificar o nome do projeto. Pode repetir?';
      }

      const doc = await criarProjeto(nome.trim(), {
        cliente: (dados.cliente as string) ?? undefined,
        status: (dados.status as 'ativo' | 'pausado' | 'concluido') ?? 'ativo',
        valor_estimado: (dados.valor_estimado as number) ?? undefined,
      });

      if (!doc) {
        return 'Erro ao salvar o projeto. Tenta de novo.';
      }

      const clienteStr = dados.cliente ? `\nCliente: ${dados.cliente as string}` : '';
      return `✓ Projeto salvo\nNome: ${nome}${clienteStr}\nStatus: ${(dados.status as string) ?? 'ativo'}`;
    }

    case 'criar_financeiro': {
      const descricao = dados.descricao as string | null;
      if (!descricao?.trim()) {
        return 'Não consegui identificar a descrição do lançamento. Pode repetir?';
      }
      if (!dados.valor || isNaN(Number(dados.valor))) {
        return 'Não consegui identificar o valor. Pode repetir com o valor numérico?';
      }

      const doc = await criarFinanceiro(descricao.trim(), {
        valor: dados.valor as number,
        tipo: dados.tipo as 'receita' | 'despesa',
        projeto: (dados.projeto as string) ?? undefined,
      });

      if (!doc) {
        return 'Erro ao salvar o lançamento. Tenta de novo.';
      }

      const sinal = (dados.tipo as string) === 'receita' ? '+' : '-';
      return `✓ Financeiro salvo\n${sinal} R$${(dados.valor as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${descricao}`;
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

    case 'deletar_item': {
      const tipo = dados.tipo as string | null;
      const buscaTitulo = dados.busca_titulo as string | null;

      if (!buscaTitulo?.trim()) {
        return 'Para deletar, diga o nome do item. Ex: "deleta a tarefa Ligar pro Marcio"';
      }

      const tiposValidos = ['task', 'lead', 'project', 'financial'];

      // Monta a query — se tipo não informado ou inválido, busca em todos os tipos
      let query = supabase
        .from('vault_documents')
        .select('id, title, type, metadata')
        .ilike('title', `%${buscaTitulo.trim()}%`)
        .limit(5);

      if (tipo && tiposValidos.includes(tipo)) {
        query = query.eq('type', tipo) as typeof query;
      }

      const { data: matches, error } = await query;

      if (error) {
        console.error('[intent] erro ao buscar para deletar:', error);
        return 'Erro ao buscar o item. Tenta de novo.';
      }

      if (!matches || matches.length === 0) {
        const tipoNome = tipoParaNome(tipo);
        return `Não encontrei nenhum(a) ${tipoNome} com "${buscaTitulo}".`;
      }

      if (matches.length === 1) {
        const item = matches[0] as VaultDocument;
        await criarPendingAction(phone, 'delete', {
          item_id: item.id,
          item_title: item.title,
          item_type: item.type,
        });
        const prazoInfo = getPrazoInfo(item);
        return `Encontrei: "${item.title}"${prazoInfo}\nDeseja deletar? Responda CONFIRMAR ou CANCELAR.`;
      }

      // Múltiplos matches — listar para o usuário escolher
      const lista = matches
        .map((item, i) => {
          const prazoInfo = getPrazoInfo(item as VaultDocument);
          return `${i + 1}. ${(item as VaultDocument).title}${prazoInfo}`;
        })
        .join('\n');

      await criarPendingAction(phone, 'delete_selection', {
        items: matches.map((item) => ({
          id: item.id,
          title: (item as VaultDocument).title,
          type: item.type,
        })),
      });

      return `Encontrei ${matches.length} itens:\n${lista}\n\nQual deles? Responda com o número ou CANCELAR.`;
    }

    case 'resposta_simples':
    default:
      return result.resposta;
  }
}

function tipoParaNome(tipo: string): string {
  const mapa: Record<string, string> = {
    task: 'tarefa',
    lead: 'lead',
    project: 'projeto',
    financial: 'lançamento financeiro',
  };
  return mapa[tipo] ?? tipo;
}

function getPrazoInfo(item: VaultDocument): string {
  const meta = item.metadata as Record<string, unknown>;
  if (meta?.prazo) return ` (prazo: ${meta.prazo as string})`;
  return '';
}

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function processarComBrain(
  historico: Anthropic.MessageParam[],
  mensagem: string,
  phone: string,
): Promise<string> {
  try {
    const result = await detectarIntent(historico, mensagem);
    if (!result) {
      return 'Não entendi bem. Pode reformular?';
    }
    return await executarIntent(result, phone);
  } catch (err) {
    console.error('[brain] erro:', err);
    return 'Erro interno no assistente. Tenta de novo.';
  }
}

export async function listarFormatado(type: 'task' | 'lead' | 'project' | 'financial'): Promise<string> {
  const docs = await listar(type, undefined, 20);
  switch (type) {
    case 'task': return formatarTarefas(docs);
    case 'lead': return formatarLeads(docs);
    case 'project': return formatarProjetos(docs);
    case 'financial': return formatarFinanceiro(docs);
  }
}
