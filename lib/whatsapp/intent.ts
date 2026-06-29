/**
 * AI Brain — detecta a intenção do dono do negócio (Roberto) e age no vault.
 * Usado quando o remetente é o OWNER_PHONE configurado em .env.local.
 */

import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/config/ai';
import {
  listar,
  atualizar,
  criarTarefa,
  criarLead,
  criarProjeto,
  criarFinanceiro,
  criarObjetivo,
  formatarTarefas,
  formatarLeads,
  formatarProjetos,
  formatarFinanceiro,
  formatarObjetivos,
  agendarLembretes,
  listarLembretes,
  cancelarLembretes,
  type VaultDocument,
  type GoalMetadata,
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
  | 'criar_objetivo'
  | 'listar_tarefas'
  | 'listar_leads'
  | 'listar_projetos'
  | 'listar_financeiro'
  | 'listar_objetivos'
  | 'atualizar_tarefa'
  | 'atualizar_progresso'
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

  // Snapshot leve de tarefas pendentes (injetado no contexto sem chamada extra ao Claude)
  // Usa phone vazio para getBrainSystem — o snapshot é apenas visual, sem isolamento crítico aqui
  // O isolamento real acontece nos executores que recebem o phone correto
  const OWNER_PHONE = process.env.OWNER_PHONE ?? '';
  const tarefasPendentes = OWNER_PHONE
    ? await listar(OWNER_PHONE, 'task', { status: 'pendente' }, 5)
    : [];
  const snapshotTarefas = tarefasPendentes.length > 0
    ? `\n\n## Suas tarefas pendentes (use apenas se perguntado ou relevante)\n${formatarTarefas(tarefasPendentes)}`
    : '';

  const template = await getPrompt('brain_system');

  // Se o prompt do DB não contiver os intents novos, usa o fallback atualizado
  const promptDesatualizado = !template || !template.includes('atualizar_tarefa');

  if (promptDesatualizado) {
    return buildFallbackPrompt(tabelaDatas) + snapshotTarefas;
  }

  return template.replace('{{DATA_BRASILIA}}', tabelaDatas) + snapshotTarefas;
}

function buildFallbackPrompt(tabelaDatas: string): string {
  return `Você é o assistente pessoal de Roberto, sócio da Cauline Roots (startup de agentes de IA para marmoraria e marcenaria).

Seu papel: entender o que Roberto quer fazer e responder com um JSON contendo a ação e os dados extraídos da mensagem.

## Ferramentas disponíveis
- SALVAR: tarefas, leads, projetos, financeiro, objetivos — descreva e eu registro
- LISTAR: pergunte suas tarefas, leads, projetos, financeiro ou objetivos
- DELETAR: "deleta a tarefa X" — dupla confirmação antes de executar
- OBJETIVOS: crie metas (ex: "minha meta é fazer 5 vendas essa semana") e acompanhe progresso
- DASHBOARD / PAINEL: acesse o painel visual completo — diga "dashboard", "painel", "manda o link" etc. para receber o link de acesso
- PDF → ORÇAMENTO MARMORARIA: envie um PDF de projeto de marmoraria (tampos, rodapés, revestimentos) — o orçamento detalhado por ambiente chega de volta aqui no WhatsApp em 1-2 minutos
- PDF → ORÇAMENTO MARCENARIA: PDFs de marcenaria enviados por clientes são processados e o resultado aparece no PC automaticamente
- GOOGLE CALENDAR: conecte via /calendar, cria eventos ao salvar tarefas com prazo
- PROMPTS: comando "prompt" → ver/editar prompts do sistema
- MENU / AJUDA: diga "o que você pode fazer", "menu", "ajuda" ou "opções" para ver esta lista

## Referência de datas (OBRIGATÓRIO usar essa tabela)
${tabelaDatas}

Regras de data:
- "amanhã" = primeiro dia da tabela acima
- "semana que vem" = segunda-feira 7+ dias à frente
- Se não mencionar data, prazo = null

## Formato de resposta OBRIGATÓRIO
SEMPRE responda SOMENTE com JSON válido — NUNCA texto puro, NUNCA markdown, NUNCA explicações fora do JSON.
- Ação única: { "intent": "...", "dados": { ... }, "resposta": "<texto confirmação>" }
- Múltiplas ações independentes: [ { "intent": "...", "dados": { ... }, "resposta": "" }, ... ]
  No array, deixe "resposta" vazio — o sistema gera a confirmação automaticamente.
- Quando não há ação a executar (dúvida, esclarecimento, resposta conversacional):
  { "intent": "resposta_simples", "dados": {}, "resposta": "<texto>" }
- NUNCA retorne texto fora de um objeto JSON. Mesmo perguntas de esclarecimento devem estar em "resposta" dentro do JSON.

## Tipos: criar_tarefa | criar_lead | criar_projeto | criar_financeiro | criar_objetivo | listar_tarefas | listar_leads | listar_projetos | listar_financeiro | listar_objetivos | atualizar_tarefa | atualizar_progresso | deletar_item | listar_lembretes | cancelar_lembrete | resposta_simples

### criar_tarefa — dados: { titulo, prazo, prazo_hora, urgencia, descricao }
prazo: ISO date "YYYY-MM-DD" | null. prazo_hora: "HH:MM" (24h) | null — extraia de "às 10h" → "10:00", "às 14h30" → "14:30".
### criar_lead — dados: { nome, empresa, telefone, interesse }
### criar_projeto — dados: { nome, cliente, status, valor_estimado }
### criar_financeiro — dados: { descricao, valor, tipo, projeto }
### criar_objetivo — dados: { descricao, periodo, unidade, meta_valor, keywords }
Gatilhos: "meta", "objetivo", "quero fazer X por semana/mês". periodo: "semanal"|"mensal". Ex: "minha meta é fazer 5 vendas essa semana" → { descricao: "5 vendas na semana", periodo: "semanal", unidade: "vendas", meta_valor: 5 }
### listar_objetivos — dados: {} — Gatilhos: "meus objetivos", "minhas metas"
### atualizar_tarefa — dados: { busca_titulo: string, novo_status: "pendente"|"em_andamento"|"concluida"|null, novo_prazo: string|null, novo_prazo_hora: string|null }
Gatilhos: "altere", "altera", "alterar", "muda", "mude", "edita", "edite", "atualiza", "atualize", "marcar como concluída", "tarefa X foi feita/concluída", "adiar tarefa X", "tarefa X está em andamento", "muda prazo da tarefa X", "reagenda", "reagende".
IMPORTANTE: se o usuário usar qualquer palavra de edição/alteração + nome de tarefa existente, use atualizar_tarefa — NÃO crie uma nova.
busca_titulo: parte do título para encontrar a tarefa. novo_status: novo status (null = não muda). novo_prazo: "YYYY-MM-DD" ou null. novo_prazo_hora: "HH:MM" ou null.

### atualizar_progresso — dados: { incremento: number, unidade: string | null }
Gatilhos: "fiz mais uma venda", "fechei negócio", "consegui X leads". Incrementa progresso_atual do objetivo ativo. Se não souber a unidade, use incremento: 1.
### deletar_item — dados: { tipo: "task"|"lead"|"project"|"financial"|"goal" | null, busca_titulo: string }
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
    // Se Claude retornou texto puro (ex: mensagem de ambiguidade), encapsula como resposta_simples
    const textoLimpo = raw.trim();
    console.warn('[intent] falha ao parsear JSON — usando texto como resposta_simples:', textoLimpo.slice(0, 200));
    if (textoLimpo.length > 0) {
      return { intent: 'resposta_simples', dados: {}, resposta: textoLimpo } as IntentResult;
    }
    return null;
  }
}

// ─── Executor de intenções ────────────────────────────────────────────────────

async function executarIntent(result: IntentResult, phone: string): Promise<string> {
  // Injeta phone nos dados para uso interno dos executores (ex: reagendar lembretes)
  result.dados = { ...result.dados, _phone: phone };

  const { intent, dados } = result;

  switch (intent) {
    case 'criar_tarefa': {
      const titulo = (dados.titulo as string | null)?.trim() || 'Tarefa sem título';

      const prazoHora = (dados.prazo_hora as string) ?? undefined;

      const doc = await criarTarefa(phone, titulo, {
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
              atualizar(phone, doc.id, {
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

      const doc = await criarLead(phone, nome, {
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

      const doc = await criarProjeto(phone, nome, {
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

      const doc = await criarFinanceiro(phone, descricao, {
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
      const querConcluidas = dados.status === 'concluida' ||
        /conclu[ií]d/i.test((dados.busca ?? '') as string);

      const todas = await listar(phone, 'task', undefined, 30);

      let exibir: VaultDocument[];
      let sufixo = '';

      if (querConcluidas) {
        exibir = todas.filter(d => (d.metadata as { status?: string }).status === 'concluida');
      } else {
        // Por padrão: só pendentes e em andamento
        exibir = todas.filter(d => {
          const s = (d.metadata as { status?: string }).status;
          return s !== 'concluida';
        });
        const nConcluidas = todas.length - exibir.length;
        if (nConcluidas > 0) {
          sufixo = `\n\n✅ ${nConcluidas} concluída(s) oculta(s). Diga "tarefas concluídas" para ver.`;
        }
      }

      if (exibir.length === 0) return querConcluidas ? 'Nenhuma tarefa concluída.' : 'Nenhuma tarefa pendente.';
      return `Tarefas:\n${formatarTarefas(exibir)}${sufixo}`;
    }

    case 'atualizar_tarefa': {
      const buscaTitulo = ((dados.busca_titulo as string | null) ?? '').toLowerCase().trim();
      if (!buscaTitulo) return 'Me diga qual tarefa quer atualizar.';

      const todas = await listar(phone, 'task', undefined, 30);
      const encontrada = todas.find(d => d.title.toLowerCase().includes(buscaTitulo));

      if (!encontrada) {
        return `Não encontrei nenhuma tarefa com "${dados.busca_titulo}". Verifica o nome e tenta de novo.`;
      }

      const metaAtual = encontrada.metadata as Record<string, unknown>;
      const novaMeta = { ...metaAtual };
      const mudancas: string[] = [];
      let prazoMudou = false;

      if (dados.novo_status) {
        novaMeta.status = dados.novo_status;
        const labelStatus: Record<string, string> = {
          concluida: 'concluída ✅',
          em_andamento: 'em andamento 🔄',
          pendente: 'pendente ⏳',
        };
        mudancas.push(`status → ${labelStatus[dados.novo_status as string] ?? dados.novo_status}`);
      }

      if (dados.novo_prazo) {
        novaMeta.prazo = dados.novo_prazo;
        mudancas.push(`prazo → ${dados.novo_prazo}`);
        prazoMudou = true;
      }

      if (dados.novo_prazo_hora) {
        novaMeta.prazo_hora = dados.novo_prazo_hora;
        mudancas.push(`horário → ${dados.novo_prazo_hora}`);
        prazoMudou = true;
      }

      const ok = await atualizar(phone, encontrada.id, { metadata: novaMeta });
      if (!ok) return 'Erro ao atualizar a tarefa. Tenta de novo.';

      // Reagenda lembretes se prazo/horário mudou
      let lembreteInfo = '';
      if (prazoMudou && novaMeta.prazo) {
        const phone = dados._phone as string | undefined;
        if (phone) {
          await cancelarLembretes(phone, encontrada.id);
          const n = await agendarLembretes(
            encontrada.id,
            phone,
            novaMeta.prazo as string,
            novaMeta.prazo_hora as string | undefined,
          );
          lembreteInfo = n > 0 ? `\nLembretes: ${n} reagendados` : '';
        }
      }

      return `✓ "${encontrada.title}" atualizada\n${mudancas.join('\n')}${lembreteInfo}`;
    }

    case 'listar_leads': {
      const filtros: Record<string, unknown> = {};
      if (dados.status) filtros.status = dados.status;
      const docs = await listar(phone, 'lead', Object.keys(filtros).length ? filtros : undefined, 15);
      const lista = formatarLeads(docs);
      return `Leads:\n${lista}`;
    }

    case 'listar_projetos': {
      const docs = await listar(phone, 'project', undefined, 10);
      const lista = formatarProjetos(docs);
      return `Projetos:\n${lista}`;
    }

    case 'listar_financeiro': {
      const docs = await listar(phone, 'financial', undefined, 20);
      const lista = formatarFinanceiro(docs);
      return `Financeiro:\n${lista}`;
    }

    case 'criar_objetivo': {
      const descricao = (dados.descricao as string | null)?.trim() || 'Objetivo sem descrição';
      const periodo = (dados.periodo as 'semanal' | 'mensal') ?? 'semanal';
      const unidade = (dados.unidade as string) ?? 'itens';
      const meta_valor = dados.meta_valor && !isNaN(Number(dados.meta_valor))
        ? Number(dados.meta_valor)
        : 1;
      const keywords = Array.isArray(dados.keywords) ? dados.keywords as string[] : [];

      const doc = await criarObjetivo(phone, descricao, {
        periodo,
        unidade,
        meta_valor,
        keywords,
        status: 'ativo',
      });

      if (!doc) return 'Erro ao salvar o objetivo. Tenta de novo.';
      return `✓ Objetivo salvo\n${descricao}\nMeta: ${meta_valor} ${unidade} (${periodo})\nProgresso: 0/${meta_valor}`;
    }

    case 'listar_objetivos': {
      const docs = await listar(phone, 'goal', undefined, 10);
      const lista = formatarObjetivos(docs);
      return `Objetivos:\n${lista}`;
    }

    case 'atualizar_progresso': {
      const incremento = dados.incremento && !isNaN(Number(dados.incremento))
        ? Number(dados.incremento)
        : 1;

      // Busca objetivos ativos ordenados por criação (mais recente primeiro)
      const goals = await listar(phone, 'goal', undefined, 10);
      const ativo = goals.find((g) => (g.metadata as GoalMetadata).status === 'ativo');

      if (!ativo) {
        return 'Nenhum objetivo ativo encontrado. Crie um primeiro: "minha meta é fazer X por semana".';
      }

      const meta = ativo.metadata as GoalMetadata;
      const novoProgresso = (meta.progresso_atual ?? 0) + incremento;
      const ok = await atualizar(phone, ativo.id, {
        metadata: { ...meta, progresso_atual: novoProgresso },
      });

      if (!ok) return 'Erro ao atualizar o progresso. Tenta de novo.';

      const pct = meta.meta_valor > 0 ? Math.round((novoProgresso / meta.meta_valor) * 100) : 0;
      const concluido = novoProgresso >= meta.meta_valor;
      const emoji = concluido ? '🎉' : pct >= 75 ? '💪' : '📈';
      return `${emoji} Progresso atualizado\n${ativo.title}\n${novoProgresso}/${meta.meta_valor} ${meta.unidade} (${pct}%)${concluido ? '\nMeta atingida! 🏆' : ''}`;
    }

    case 'deletar_item': {
      const tipo = dados.tipo as string | null;
      const buscaTitulo = dados.busca_titulo as string | null;

      if (!buscaTitulo?.trim()) {
        return 'Para deletar, diga o nome do item. Ex: "deleta a tarefa Ligar pro Marcio"';
      }

      const tiposValidos = ['task', 'lead', 'project', 'financial'];

      const matches = await buscarParaDeletar(phone, buscaTitulo.trim(), tipo && tiposValidos.includes(tipo) ? tipo : null);

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
  phone: string,
  busca: string,
  tipo: string | null,
): Promise<VaultDocument[] | null> {
  const buildQuery = (filtro: string) => {
    let q = supabase
      .from('vault_documents')
      .select('id, title, type, metadata')
      .eq('phone', phone)
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
  let q = supabase.from('vault_documents').select('id, title, type, metadata').eq('phone', phone).limit(50);
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

export async function listarFormatado(phone: string, type: 'task' | 'lead' | 'project' | 'financial' | 'goal'): Promise<string> {
  const docs = await listar(phone, type, undefined, 20);
  switch (type) {
    case 'task': return formatarTarefas(docs);
    case 'lead': return formatarLeads(docs);
    case 'project': return formatarProjetos(docs);
    case 'financial': return formatarFinanceiro(docs);
    case 'goal': return formatarObjetivos(docs);
  }
}
