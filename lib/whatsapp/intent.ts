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
  agendarLembretes,
  listarLembretes,
  cancelarLembretes,
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
  | 'listar_lembretes'
  | 'cancelar_lembrete'
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
Sempre responda APENAS com JSON válido, sem texto antes ou depois.
- Ação única: { "intent": "...", "dados": { ... }, "resposta": "<texto>" }
- Múltiplas ações (ex: "adiciona tarefa X e Y", "anota A, B e C"):
  [ { "intent": "...", "dados": { ... }, "resposta": "" }, { "intent": "...", "dados": { ... }, "resposta": "" } ]
  No array, deixe "resposta" vazio — o sistema gera a confirmação automaticamente.

## Tipos: criar_tarefa | criar_lead | criar_projeto | criar_financeiro | listar_tarefas | listar_leads | listar_projetos | listar_financeiro | deletar_item | listar_lembretes | cancelar_lembrete | resposta_simples

### criar_tarefa — dados: { titulo, prazo, prazo_hora, urgencia, descricao }
prazo: ISO date "YYYY-MM-DD" | null. prazo_hora: "HH:MM" (24h) | null — extraia de "às 10h" → "10:00", "às 14h30" → "14:30".
### criar_lead — dados: { nome, empresa, telefone, interesse }
### criar_projeto — dados: { nome, cliente, status, valor_estimado }
### criar_financeiro — dados: { descricao, valor, tipo, projeto }
### deletar_item — dados: { tipo: "task"|"lead"|"project"|"financial" | null, busca_titulo: string }
Gatilhos: "deleta", "remova", "remove", "apaga", "exclui". Processe APENAS UM item. Para múltiplos deletes, use resposta_simples pedindo um de cada vez. Se o tipo não for mencionado, deixe tipo = null.
### listar_lembretes — dados: {} — Gatilhos: "lembretes", "meus lembretes", "que lembretes tenho"
### cancelar_lembrete — dados: { busca_titulo: string | null } — Cancela lembretes de uma tarefa (ou todos se busca_titulo = null). Gatilhos: "cancela lembrete", "remove lembrete", "apaga lembrete"
### listar_* — dados conforme tipo

## Regras gerais
- Valores monetários: extraia apenas o número (ex: "R$500" → 500)
- NUNCA use markdown na resposta — é para WhatsApp, texto puro`;
}

// ─── Parser de intent ─────────────────────────────────────────────────────────

async function detectarIntent(
  historico: Anthropic.MessageParam[],
  mensagem: string,
): Promise<IntentResult | IntentResult[] | null> {
  const systemPrompt = await getBrainSystem();

  const messages: Anthropic.MessageParam[] = [
    ...historico.slice(-6),
    { role: 'user', content: mensagem },
  ];

  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const raw = res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('');

  try {
    // Tenta array primeiro: [ {...}, {...} ]
    const arrayStr = raw.match(/\[[\s\S]*\]/)?.[0];
    if (arrayStr) {
      const arr = JSON.parse(arrayStr) as IntentResult[];
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
    // Fallback para objeto único
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
      const titulo = (dados.titulo as string | null)?.trim() || 'Tarefa sem título';

      const prazoHora = (dados.prazo_hora as string) ?? undefined;

      const doc = await criarTarefa(titulo, {
        prazo: (dados.prazo as string) ?? undefined,
        prazo_hora: prazoHora,
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

      // Agenda lembretes automáticos se houver prazo
      let lembreteStr = '';
      if (doc && dados.prazo) {
        const qtd = await agendarLembretes(doc.id, phone, dados.prazo as string, prazoHora);
        if (qtd > 0) {
          lembreteStr = prazoHora
            ? `\nLembretes: ${qtd} agendados (24h, 12h, 6h, 2h, 1h, 30m, 10m, 2m antes)`
            : `\nLembretes: agendados (24h antes e manhã do dia)`;
        }
      }

      const prazoStr = dados.prazo
        ? prazoHora ? `${dados.prazo as string} às ${prazoHora}` : (dados.prazo as string)
        : 'sem prazo';
      const urgenciaStr = (dados.urgencia as string) ?? 'media';
      return `✓ Tarefa salva\nTítulo: ${titulo}\nPrazo: ${prazoStr}\nUrgência: ${urgenciaStr}${lembreteStr}`;
    }

    case 'criar_lead': {
      const nome = (dados.nome as string | null)?.trim() || 'Lead sem nome';

      const doc = await criarLead(nome, {
        empresa: (dados.empresa as string) ?? undefined,
        telefone: (dados.telefone as string) ?? undefined,
        interesse: (dados.interesse as string) ?? undefined,
      });

      if (!doc) {
        return 'Erro ao salvar o lead. Tenta de novo.';
      }

      const empresaStr = dados.empresa ? ` (${dados.empresa as string})` : '';
      const avisoNome = nome === 'Lead sem nome' ? '\n⚠ Nome não informado — atualize depois.' : '';
      return `✓ Lead salvo\nNome: ${nome}${empresaStr}${avisoNome}`;
    }

    case 'criar_projeto': {
      const nome = (dados.nome as string | null)?.trim() || 'Projeto sem nome';

      const doc = await criarProjeto(nome, {
        cliente: (dados.cliente as string) ?? undefined,
        status: (dados.status as 'ativo' | 'pausado' | 'concluido') ?? 'ativo',
        valor_estimado: (dados.valor_estimado as number) ?? undefined,
      });

      if (!doc) {
        return 'Erro ao salvar o projeto. Tenta de novo.';
      }

      const clienteStr = dados.cliente ? `\nCliente: ${dados.cliente as string}` : '';
      const avisoNomeProjeto = nome === 'Projeto sem nome' ? '\n⚠ Nome não informado — atualize depois.' : '';
      return `✓ Projeto salvo\nNome: ${nome}${clienteStr}\nStatus: ${(dados.status as string) ?? 'ativo'}${avisoNomeProjeto}`;
    }

    case 'criar_financeiro': {
      const descricao = (dados.descricao as string | null)?.trim() || 'Lançamento sem descrição';
      const valor = dados.valor && !isNaN(Number(dados.valor)) ? Number(dados.valor) : 0;

      const doc = await criarFinanceiro(descricao, {
        valor,
        tipo: (dados.tipo as 'receita' | 'despesa') ?? 'despesa',
        projeto: (dados.projeto as string) ?? undefined,
      });

      if (!doc) {
        return 'Erro ao salvar o lançamento. Tenta de novo.';
      }

      const sinal = (dados.tipo as string) === 'receita' ? '+' : '-';
      const avisoValor = valor === 0 ? '\n⚠ Valor não informado — atualize depois.' : '';
      return `✓ Financeiro salvo\n${sinal} R$${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — ${descricao}${avisoValor}`;
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

      const matches = await buscarParaDeletar(buscaTitulo.trim(), tipo && tiposValidos.includes(tipo) ? tipo : null);

      if (!matches) {
        return 'Erro ao buscar o item. Tenta de novo.';
      }

      if (matches.length === 0) {
        const tipoNome = tipoParaNome(tipo ?? '');
        return `Não encontrei ${tipoNome ? `nenhum(a) ${tipoNome}` : 'nenhum item'} com "${buscaTitulo}".`;
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

    case 'listar_lembretes': {
      return await listarLembretes(phone);
    }

    case 'cancelar_lembrete': {
      const buscaTitulo = dados.busca_titulo as string | null;

      if (!buscaTitulo?.trim()) {
        // Cancela todos os lembretes pendentes
        const qtd = await cancelarLembretes(phone);
        return qtd > 0
          ? `✓ ${qtd} lembrete(s) cancelado(s).`
          : 'Nenhum lembrete pendente para cancelar.';
      }

      // Busca a tarefa pelo título para cancelar lembretes específicos
      const { data: encontrados } = await supabase
        .from('vault_documents')
        .select('id, title')
        .ilike('title', `%${buscaTitulo.trim()}%`)
        .eq('type', 'task')
        .limit(3);

      if (!encontrados || encontrados.length === 0) {
        return `Não encontrei tarefa com "${buscaTitulo}" para cancelar os lembretes.`;
      }

      if (encontrados.length === 1) {
        const tarefa = encontrados[0] as VaultDocument;
        const qtd = await cancelarLembretes(phone, tarefa.id);
        return qtd > 0
          ? `✓ Lembretes de "${tarefa.title}" cancelados.`
          : `Nenhum lembrete pendente para "${tarefa.title}".`;
      }

      // Múltiplos — pede para especificar
      const lista = encontrados.map((t, i) => `${i + 1}. ${(t as VaultDocument).title}`).join('\n');
      return `Encontrei ${encontrados.length} tarefas com esse nome:\n${lista}\n\nEspecifica melhor qual tarefa.`;
    }

    case 'resposta_simples':
    default:
      return result.resposta;
  }
}

// Palavras irrelevantes para busca fuzzy (stopwords PT-BR)
const STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'para', 'por', 'em',
  'no', 'na', 'nos', 'nas', 'e', 'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'que', 'se', 'ao', 'aos', 'c', 'p', 'pra', 'pro']);

async function buscarParaDeletar(
  busca: string,
  tipo: string | null,
): Promise<VaultDocument[] | null> {
  const buildQuery = (filtro: string) => {
    let q = supabase
      .from('vault_documents')
      .select('id, title, type, metadata')
      .ilike('title', filtro)
      .limit(5);
    if (tipo) q = q.eq('type', tipo) as typeof q;
    return q;
  };

  // 1ª tentativa: busca direta com o termo completo
  const { data: exato, error: err1 } = await buildQuery(`%${busca}%`);
  if (err1) { console.error('[intent] erro ao buscar:', err1); return null; }
  if (exato && exato.length > 0) return exato as VaultDocument[];

  // 2ª tentativa: busca por palavras significativas (fuzzy fallback)
  const palavras = busca
    .toLowerCase()
    .split(/\s+/)
    .filter(p => p.length >= 3 && !STOPWORDS.has(p));

  if (palavras.length === 0) return [];

  // Carrega todos os itens do tipo e faz score por palavras que batem
  let q = supabase.from('vault_documents').select('id, title, type, metadata').limit(50);
  if (tipo) q = q.eq('type', tipo) as typeof q;
  const { data: todos, error: err2 } = await q;
  if (err2 || !todos) return [];

  const scored = todos
    .map((item) => {
      const titleLower = (item.title as string).toLowerCase();
      const hits = palavras.filter(p => titleLower.includes(p)).length;
      return { item: item as VaultDocument, hits };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits);

  return scored.slice(0, 5).map(s => s.item);
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

    // Múltiplos intents — executa em paralelo e consolida respostas
    if (Array.isArray(result)) {
      const respostas = await Promise.all(result.map(r => executarIntent(r, phone)));
      return respostas.join('\n\n');
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
