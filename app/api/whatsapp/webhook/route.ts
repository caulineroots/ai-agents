import { processarMensagem, carregarHistorico, salvarMensagem } from '@/lib/whatsapp/bot';
import { processarPdfMarcenaria } from '@/lib/whatsapp/marcenaria-job';
import { processarPdfMarmoraria } from '@/lib/whatsapp/marmoraria-job';
import { processarComBrain } from '@/lib/whatsapp/intent';
import { executarCursorAgent } from '@/lib/whatsapp/cursor-agent';
import { getAuthUrl, calendarConectado } from '@/lib/whatsapp/calendar';
import { supabase } from '@/lib/supabase/client';
import { getPrompt, setPrompt, listPrompts } from '@/lib/whatsapp/prompts-db';
import { createSession } from '@/lib/dashboard/session';
import {
  criarPendingAction,
  getPendingAction,
  getAnyPendingAction,
  cancelarPendingAction,
  cancelarPendingActionById,
  getTodasTaskChecks,
} from '@/lib/whatsapp/pending-actions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const OWNER_PHONE = process.env.OWNER_PHONE ?? '';
const ALLOWED_PHONES = new Set(
  (process.env.ALLOWED_PHONES ?? '').split(',').map(p => p.trim()).filter(Boolean),
);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? 'https://ai.caulineroots.com';

// ─── Detecção de comandos por linguagem natural ───────────────────────────────

const DASHBOARD_REGEX = /\b(dash\w*|painel|link|acesso|acessar|entrar|abrir|manda o link|ver o painel|quero ver|painel visual|sistema|meu painel)\b/i;
const MENU_REGEX = /\b(menu|ajuda|help|o que (você|vc) (pode|consegue|faz)|o que (está|estou|ta) conectado|opções|funcionalidades|como funciona|tudo que|todos os comandos|comandos|capabilities)\b/i;

function gerarMensagemMenu(): string {
  return `Olá! Aqui está tudo que posso fazer por você:

📋 *Tarefas* — adicionar, listar, atualizar, marcar como concluída
👤 *Leads / Contatos* — salvar, acompanhar status, follow-up
📁 *Projetos* — criar e gerenciar projetos
💰 *Financeiro* — registrar entradas e saídas
🎯 *Objetivos* — definir metas e acompanhar progresso
📊 *Dashboard (Painel)* — acesso visual completo → manda "painel" para receber o link
📄 *Orçamento PDF* — envia um PDF de marmoraria e eu calculo por ambiente
📅 *Lembretes* — automáticos ao criar tarefas com prazo

Alguns exemplos:
• "anota tarefa: ligar pro João amanhã às 14h"
• "novo lead: Maria Silva da empresa X"
• "gastei R$500 no fornecedor Y"
• "minha meta é fazer 5 vendas essa semana"
• "meus leads" / "minhas tarefas"
• "painel" → link de acesso ao dashboard`;
}

function gerarLinkDashboard(): string {
  return `📊 *Acesso ao Dashboard*\n\nLink: ${BASE_URL}/login\n\n👤 Usuário: seu número com DDI (ex: 5511914991065)\n🔑 Senha: 1234`;
}

export const runtime = 'nodejs';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;
const BUCKET = 'offer-app-bucket';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'sa-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Dedupe: Evolution dispara vários upserts por msg (msg + DELIVERY_ACK)
const processedMessageIds = new Map<string, number>();
const DEDUPE_TTL_MS = 10 * 60 * 1000;

function isDuplicateMessage(messageId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of processedMessageIds) {
    if (now - ts > DEDUPE_TTL_MS) processedMessageIds.delete(id);
  }
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.set(messageId, now);
  return false;
}

// Cache phone → JID @lid (WhatsApp privacy mode)
const lidJidCache = new Map<string, string>();

function normalizeLidJid(jid: string): string {
  // 272043916394569:27@lid → 272043916394569@lid
  return jid.replace(/:\d+@lid$/, '@lid');
}

function loadLidOverrides(): Map<string, string> {
  const map = new Map<string, string>();
  const raw = process.env.WHATSAPP_LID_OVERRIDES ?? '';
  for (const part of raw.split(/[,;]/)) {
    const [phone, jid] = part.split('=').map((s) => s.trim());
    if (phone && jid?.includes('@lid')) map.set(phone, normalizeLidJid(jid));
  }
  return map;
}

const lidOverrides = loadLidOverrides();

function extractLidFromObject(obj: unknown, phone: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractLidFromObject(item, phone);
      if (found) return found;
    }
    return null;
  }

  const record = obj as Record<string, unknown>;
  const remoteJid = record.remoteJid;
  const remoteJidAlt = record.remoteJidAlt;

  if (typeof remoteJid === 'string' && remoteJid.includes('@lid')) {
    const alt = typeof remoteJidAlt === 'string' ? remoteJidAlt : '';
    if (alt.includes(phone) || remoteJid.includes(phone)) {
      return normalizeLidJid(remoteJid);
    }
  }

  for (const value of Object.values(record)) {
    const found = extractLidFromObject(value, phone);
    if (found) return found;
  }
  return null;
}

function parseWhatsappNumbersItems(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    for (const key of ['numbers', 'data', 'result']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
}

async function fetchLidJidViaNumbers(instance: string, phone: string): Promise<string | null> {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ numbers: [phone] }),
    });
    if (!res.ok) {
      console.warn('[webhook] whatsappNumbers status:', res.status);
      return null;
    }

    const json = await res.json();
    const items = parseWhatsappNumbersItems(json);

    for (const item of items) {
      const jid = typeof item.jid === 'string' ? item.jid : null;
      // lid field is a flag ("lid"), not the JID — real @lid is in jid when cached
      if (jid?.includes('@lid')) {
        const normalized = normalizeLidJid(jid);
        lidJidCache.set(phone, normalized);
        console.log('[webhook] LID resolvido via whatsappNumbers:', phone, '→', normalized);
        return normalized;
      }
      if (item.lid === 'lid') {
        console.log('[webhook] whatsappNumbers: contato LID mas jid=', jid, '| number=', item.number);
      }
    }
  } catch (err) {
    console.warn('[webhook] whatsappNumbers erro:', err);
  }
  return null;
}

async function fetchLidJidViaMessages(instance: string, phone: string): Promise<string | null> {
  const altTargets = [`${phone}@s.whatsapp.net`, phone];
  for (const alt of altTargets) {
    try {
      const res = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({
          where: { key: { remoteJidAlt: alt } },
          page: 1,
          offset: 10,
        }),
      });
      if (!res.ok) {
        console.warn('[webhook] findMessages status:', res.status, '| alt:', alt);
        continue;
      }

      const json = await res.json();
      const messages = (Array.isArray(json)
        ? json
        : (json as { messages?: unknown[] }).messages ?? []) as Record<string, unknown>[];

      for (const msg of messages) {
        const key = msg.key as Record<string, unknown> | undefined;
        const remoteJid = key?.remoteJid;
        if (typeof remoteJid === 'string' && remoteJid.includes('@lid')) {
          const lid = normalizeLidJid(remoteJid);
          lidJidCache.set(phone, lid);
          console.log('[webhook] LID resolvido via findMessages:', phone, '→', lid);
          return lid;
        }
      }
    } catch (err) {
      console.warn('[webhook] findMessages erro | alt:', alt, err);
    }
  }
  return null;
}

async function fetchLidJidViaChats(instance: string, phone: string): Promise<string | null> {
  try {
    const res = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ where: {} }),
    });
    if (!res.ok) {
      console.warn('[webhook] findChats falhou:', res.status);
      return null;
    }

    const json = await res.json();
    const chats = (Array.isArray(json) ? json : (json as { chats?: unknown[] }).chats ?? []) as Record<
      string,
      unknown
    >[];

    console.log('[webhook] findChats retornou', chats.length, 'chats para phone', phone);

    for (const chat of chats) {
      const fromPayload = extractLidFromObject(chat, phone);
      if (fromPayload) {
        lidJidCache.set(phone, fromPayload);
        console.log('[webhook] LID resolvido via findChats:', phone, '→', fromPayload);
        return fromPayload;
      }
    }
  } catch (err) {
    console.error('[webhook] findChats erro:', err);
  }
  return null;
}

async function fetchLidJid(
  instance: string,
  phone: string,
  webhookData?: Record<string, unknown>,
): Promise<string | null> {
  const cached = lidJidCache.get(phone);
  if (cached) return cached;

  const override = lidOverrides.get(phone);
  if (override) {
    lidJidCache.set(phone, override);
    console.log('[webhook] LID via WHATSAPP_LID_OVERRIDES:', phone, '→', override);
    return override;
  }

  if (webhookData) {
    const fromWebhook = extractLidFromObject(webhookData, phone);
    if (fromWebhook) {
      lidJidCache.set(phone, fromWebhook);
      console.log('[webhook] LID extraído do webhook payload:', phone, '→', fromWebhook);
      return fromWebhook;
    }
  }

  const viaNumbers = await fetchLidJidViaNumbers(instance, phone);
  if (viaNumbers) return viaNumbers;

  const viaMessages = await fetchLidJidViaMessages(instance, phone);
  if (viaMessages) return viaMessages;

  return fetchLidJidViaChats(instance, phone);
}

async function resolveSendTarget(
  key: Record<string, unknown>,
  numero: string,
  instance: string,
  webhookData?: Record<string, unknown>,
): Promise<string> {
  for (const field of [key.remoteJid, key.remoteJidAlt, key.participant]) {
    if (typeof field === 'string' && field.endsWith('@lid')) {
      const lid = normalizeLidJid(field);
      lidJidCache.set(numero, lid);
      return lid;
    }
  }

  // Modo LID: sendText precisa do @lid, não do @s.whatsapp.net (senão erro 463)
  if (key.addressingMode === 'lid') {
    const lid = await fetchLidJid(instance, numero, webhookData);
    if (lid) return lid;
    console.error('[webhook] LID não resolvido para', numero, '| addressingMode: lid');
    // Não retorna @s.whatsapp.net — enviarResposta tentará fallbacks
    return numero;
  }

  const jid = key.remoteJidAlt ?? key.remoteJid;
  if (typeof jid === 'string' && jid.includes('@')) {
    return jid;
  }
  return numero;
}

async function enviarResposta(
  numero: string,
  texto: string,
  instance: string = EVOLUTION_INSTANCE,
  sendTarget?: string,
  quotedKey?: Record<string, unknown>,
): Promise<boolean> {
  const url = `${EVOLUTION_API_URL}/message/sendText/${instance}`;

  const targets: string[] = [];
  if (sendTarget?.includes('@lid')) targets.push(sendTarget);
  if (sendTarget && !targets.includes(sendTarget)) targets.push(sendTarget);
  targets.push(`${numero}@s.whatsapp.net`, numero);

  for (const t of [...new Set(targets)]) {
    try {
      console.log('[webhook] enviando | instance:', instance, '| target:', t, '| chars:', texto.length);

      const quotedJid =
        typeof quotedKey?.remoteJid === 'string' && quotedKey.remoteJid.includes('@lid')
          ? normalizeLidJid(quotedKey.remoteJid)
          : t.includes('@lid')
            ? t
            : `${numero}@s.whatsapp.net`;

      const payload: Record<string, unknown> = { number: t, text: texto };
      if (quotedKey?.id) {
        payload.quoted = {
          key: {
            remoteJid: quotedJid,
            fromMe: false,
            id: quotedKey.id,
          },
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      console.log('[webhook] evolution resposta:', res.status, '| target:', t, '| body:', responseText.slice(0, 300));

      if (res.ok) {
        console.log('[webhook] resposta enviada OK | target:', t);
        return true;
      }
    } catch (err) {
      console.error('[webhook] erro ao enviar resposta | target:', t, err);
    }
  }

  console.error('[webhook] enviarResposta FALHOU em todos os formatos | numero:', numero);
  return false;
}

async function baixarMidiaEvolution(
  messageKey: unknown,
  message: unknown,
  instance: string = EVOLUTION_INSTANCE,
): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instance}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ message: { key: messageKey, message } }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error('[webhook] baixarMidia erro:', res.status, txt.slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { base64?: string };
    if (!json.base64) {
      console.error('[webhook] baixarMidia: base64 ausente na resposta');
      return null;
    }
    return Buffer.from(json.base64, 'base64');
  } catch (err) {
    console.error('[webhook] baixarMidia exception:', err);
    return null;
  }
}

async function transcreverAudio(audioBuffer: Buffer): Promise<string | null> {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      console.error('[webhook] GROQ_API_KEY não configurado — Whisper indisponível');
      return null;
    }

    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: 'audio/ogg; codecs=opus' }), 'audio.ogg');
    form.append('model', 'whisper-large-v3-turbo');
    form.append('language', 'pt');
    form.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('[webhook] Groq Whisper erro:', res.status, txt.slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { text?: string };
    console.log('[webhook] Groq transcrição:', json.text?.slice(0, 80));
    return json.text ?? null;
  } catch (err) {
    console.error('[webhook] transcreverAudio exception:', err);
    return null;
  }
}

async function processarPdfJob(
  numero: string,
  instance: string,
  pdfBuffer: Buffer,
  filename: string,
  sendTarget?: string,
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const s3Key = `Arquivos/marcenaria/whatsapp/${timestamp}_${safeName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }),
  );

  const { data: job, error } = await supabase
    .from('whatsapp_jobs')
    .insert({
      phone: numero,
      instance,
      status: 'pending',
      pdf_s3_key: s3Key,
      pdf_filename: safeName,
    })
    .select('id')
    .single();

  if (error || !job) {
    console.error('[webhook] erro ao criar job:', error);
    return;
  }

  await enviarResposta(
    numero,
    `PDF recebido! Processando o orçamento de marcenaria... Isso pode levar alguns minutos. O resultado vai aparecer no PC automaticamente.`,
    instance,
    sendTarget,
  );

  processarPdfMarcenaria(job.id, pdfBuffer, safeName).catch((err) => {
    console.error('[webhook] erro no processamento do PDF:', err);
  });
}

// ─── Interceptações hardcoded para o OWNER ───────────────────────────────────

async function handleOwnerInterceptors(
  numero: string,
  texto: string,
  instance: string = EVOLUTION_INSTANCE,
): Promise<string | null> {
  const textoNorm = texto.trim().toLowerCase();

  // ── Verificar pending actions existentes primeiro ──────────────────────────

  // Estado: aguardando confirmação de tarefa (task_check do briefing diário)
  const taskChecks = await getTodasTaskChecks(numero);
  if (taskChecks.length > 0) {
    // Detecta intenção por NLP básico (aceita linguagem natural)
    const txt = textoNorm;
    let intencao: 'sim' | 'adiado' | 'cancelado' | null = null;

    if (/\b(sim|s|conclu[ií]d[ao]|fiz|feito|feita|pronto|pronta|ok|done|foi|já)\b/.test(txt)) {
      intencao = 'sim';
    } else if (/\b(adiad[ao]|adiei|adia|depois|amanhã|amanha|mais tarde|adiou|ainda)\b/.test(txt)) {
      intencao = 'adiado';
    } else if (/\b(cancelad[ao]|cancelei|cancela|n[aã]o|nao|nope|desistiu|desisti)\b/.test(txt)) {
      intencao = 'cancelado';
    }

    if (intencao) {
      const statusMap = { sim: 'concluida', adiado: 'pendente', cancelado: 'pendente' } as const;
      const emojiMap = { sim: '✅', adiado: '⏸️', cancelado: '❌' } as const;
      const labelMap = { sim: 'concluída', adiado: 'adiado', cancelado: 'cancelado' } as const;

      // Resolve a mais antiga primeiro
      const check = taskChecks[0];
      const taskId = check.metadata.task_id as string;
      const taskTitle = check.metadata.task_title as string;

      const { data: tarefaAtual } = await supabase
        .from('vault_documents')
        .select('metadata')
        .eq('id', taskId)
        .single();

      if (tarefaAtual) {
        await supabase
          .from('vault_documents')
          .update({
            metadata: { ...(tarefaAtual.metadata as Record<string, unknown>), status: statusMap[intencao] },
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId);
      }

      await cancelarPendingActionById(check.id);

      const confirmacao = `${emojiMap[intencao]} "${taskTitle}" marcada como ${labelMap[intencao]}.`;

      // Se ainda houver mais task_checks pendentes, pergunta sobre a próxima
      const restantes = taskChecks.slice(1);
      if (restantes.length > 0) {
        const proxima = restantes[0];
        const proximaTitulo = proxima.metadata.task_title as string;
        const proximaHora = proxima.metadata.task_hora as string ?? '';
        return `${confirmacao}\n\nE a tarefa "${proximaTitulo}"${proximaHora ? ` (${proximaHora})` : ''}? Foi concluída?\n\n*SIM* ✅ · *ADIADO* ⏸️ · *CANCELADO* ❌`;
      }

      return confirmacao;
    }

    // Intenção não reconhecida — lembra sobre a tarefa mais antiga pendente
    const taskTitle = taskChecks[0].metadata.task_title as string;
    return `Responda *SIM*, *ADIADO* ou *CANCELADO* para a tarefa "${taskTitle}".`;
  }

  // Estado: aguardando seleção de item para deletar (múltiplos matches)
  const deleteSelection = await getPendingAction(numero, 'delete_selection');
  if (deleteSelection) {
    const numStr = texto.trim();
    const num = parseInt(numStr, 10);
    const items = deleteSelection.metadata.items as Array<{ id: string; title: string; type: string }>;

    if (textoNorm === 'cancelar') {
      await cancelarPendingAction(numero, 'delete_selection');
      return 'Cancelado.';
    }

    // "os dois", "ambos", "todos", "1 e 2", "deletar tudo" → deleta todos
    const querTodos = /\b(os dois|ambos|todos|tudo|all)\b/.test(textoNorm) ||
      /\b1\s*(e|,)\s*2\b/.test(textoNorm);

    if (querTodos) {
      await cancelarPendingAction(numero, 'delete_selection');
      const deletados: string[] = [];
      for (const item of items) {
        const { error } = await supabase.from('vault_documents').delete().eq('id', item.id);
        if (!error) deletados.push(`"${item.title}"`);
      }
      return deletados.length > 0
        ? `✓ Deletados: ${deletados.join(', ')}.`
        : 'Erro ao deletar os itens.';
    }

    if (!isNaN(num) && num >= 1 && num <= items.length) {
      const item = items[num - 1];
      await cancelarPendingAction(numero, 'delete_selection');
      await criarPendingAction(numero, 'delete', {
        item_id: item.id,
        item_title: item.title,
        item_type: item.type,
      });
      return `Confirmar exclusão de "${item.title}"?\nResponda CONFIRMAR ou CANCELAR.`;
    }

    return `Responda com um número de 1 a ${items.length}, "os dois" para deletar todos, ou CANCELAR.`;
  }

  // Estado: aguardando novo conteúdo de prompt para editar
  const promptEdit = await getPendingAction(numero, 'prompt_edit');
  if (promptEdit) {
    if (textoNorm === 'cancelar') {
      await cancelarPendingAction(numero, 'prompt_edit');
      return 'Edição cancelada.';
    }

    const promptName = promptEdit.metadata.name as string;
    const ok = await setPrompt(promptName, texto.trim());
    await cancelarPendingAction(numero, 'prompt_edit');

    if (!ok) return `Erro ao salvar o prompt "${promptName}". Tenta de novo.`;
    return `✓ Prompt "${promptName}" atualizado com sucesso.`;
  }

  // ── Comandos de confirmação/cancelamento ──────────────────────────────────

  if (textoNorm === 'confirmar') {
    const deleteAction = await getPendingAction(numero, 'delete');
    if (!deleteAction) {
      return 'Nenhuma ação pendente para confirmar.';
    }

    const itemId = deleteAction.metadata.item_id as string;
    const itemTitle = deleteAction.metadata.item_title as string;

    // Trava de segurança: deletar APENAS pelo ID específico
    const { error } = await supabase
      .from('vault_documents')
      .delete()
      .eq('id', itemId);

    await cancelarPendingAction(numero, 'delete');

    if (error) {
      console.error('[webhook] erro ao deletar item:', error);
      return 'Erro ao deletar o item. Tenta de novo.';
    }

    return `✓ Deletado: "${itemTitle}"`;
  }

  if (textoNorm === 'cancelar') {
    const pending = await getAnyPendingAction(numero);
    if (!pending) return 'Nenhuma ação pendente para cancelar.';
    await cancelarPendingAction(numero);
    return 'Cancelado.';
  }

  // ── Comando de ajuda ─────────────────────────────────────────────────────

  if (textoNorm === 'ajuda' || textoNorm === 'help' || textoNorm === '/ajuda' || textoNorm === '/help') {
    return `Comandos disponíveis:

SALVAR
• "anota tarefa [título]" — salva uma tarefa
• "novo lead [nome]" — salva um contato
• "novo projeto [nome]" — salva um projeto
• "gastei / recebi R$X de [desc]" — lançamento financeiro

LISTAR
• "minhas tarefas" — lista tarefas
• "meus leads" — lista leads
• "meus projetos" — lista projetos
• "financeiro" — mostra entradas e saídas

DELETAR (dupla confirmação)
• "deleta tarefa [título]" — inicia fluxo de exclusão
• CONFIRMAR — confirma a exclusão
• CANCELAR — cancela qualquer ação pendente

PROMPTS
• prompt — lista os prompts do sistema
• prompt ver [1-4 ou nome] — exibe conteúdo
• prompt editar [1-4 ou nome] — edita pelo chat

OUTROS
• /calendar — conectar Google Calendar
• ajuda — exibe esta mensagem`;
  }

  // ── Comandos de prompt ────────────────────────────────────────────────────

  if (textoNorm === 'prompt') {
    const nomes = await listPrompts();
    if (nomes.length === 0) {
      return 'Nenhum prompt cadastrado. Execute a migração SQL primeiro.';
    }
    const lista = nomes.map((n, i) => `${i + 1}. ${n}`).join('\n');
    return `Prompts disponíveis:\n${lista}\n\nUse:\nprompt ver [número] — ver conteúdo\nprompt editar [número] — editar`;
  }

  if (textoNorm.startsWith('prompt ver ')) {
    const nomes = await listPrompts();
    const arg = textoNorm.slice('prompt ver '.length).trim();
    const idx = parseInt(arg, 10);
    const nome = !isNaN(idx) ? nomes[idx - 1] : arg;

    if (!nome) {
      return `Prompt não encontrado. Use "prompt" para listar.`;
    }

    const conteudo = await getPrompt(nome);
    if (!conteudo) return `Prompt "${nome}" não encontrado.`;

    // Enviar em chunks de 3000 chars para não exceder limite do WhatsApp
    const chunks: string[] = [];
    for (let i = 0; i < conteudo.length; i += 3000) {
      chunks.push(conteudo.slice(i, i + 3000));
    }

    if (chunks.length === 1) {
      return `[Prompt: ${nome}]\n\n${chunks[0]}`;
    }

    // Envia chunks intermediários diretamente e retorna o último
    for (let i = 0; i < chunks.length - 1; i++) {
      await enviarResposta(numero, `[${nome} — parte ${i + 1}/${chunks.length}]\n\n${chunks[i]}`, instance);
    }
    return `[${nome} — parte ${chunks.length}/${chunks.length}]\n\n${chunks[chunks.length - 1]}`;
  }

  if (textoNorm.startsWith('prompt editar ')) {
    const nomes = await listPrompts();
    const arg = textoNorm.slice('prompt editar '.length).trim();
    const idx = parseInt(arg, 10);
    const nome = !isNaN(idx) ? nomes[idx - 1] : arg;

    if (!nome) {
      return `Prompt não encontrado. Use "prompt" para listar.`;
    }

    await criarPendingAction(numero, 'prompt_edit', { name: nome });
    return `Ok, manda o novo conteúdo do prompt "${nome}":\n(responda CANCELAR para desistir)`;
  }

  // Nenhum interceptador aplicou — deixar passar para o Brain
  return null;
}

// ─── Handler principal ────────────────────────────────────────────────────────

function normalizeEvent(event: unknown): string {
  if (typeof event !== 'string') return '';
  return event.toLowerCase().replace(/_/g, '.');
}

function extractNumero(key: Record<string, unknown>): string | null {
  let jid = key.remoteJid;
  const alt = key.remoteJidAlt;
  // WhatsApp Business / LID: usa JID alternativo normalizado
  if (typeof jid === 'string' && jid.endsWith('@lid') && typeof alt === 'string') {
    jid = alt;
  }
  if (typeof jid !== 'string') return null;
  const match = jid.match(/^(\d+)/);
  return match?.[1] ?? null;
}

async function parseWebhookBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? '(sem content-type)';
  const raw = await request.text();

  console.log('[webhook] POST recebido | content-type:', contentType, '| body length:', raw.length);
  if (raw.length > 0) {
    console.log('[webhook] body preview:', raw.slice(0, 400));
  } else {
    console.warn('[webhook] body vazio');
    return null;
  }

  try {
    let parsed: unknown = JSON.parse(raw);
    // Algumas versões enviam data como string JSON
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('[webhook] body parseado não é objeto:', typeof parsed);
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    console.error('[webhook] JSON inválido:', err);
    console.error('[webhook] raw (200 chars):', raw.slice(0, 200));
    return null;
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    service: 'whatsapp-webhook',
    owner: OWNER_PHONE ? `${OWNER_PHONE.slice(0, 4)}...` : '(não configurado)',
    allowedCount: ALLOWED_PHONES.size,
  });
}

export async function POST(request: Request) {
  try {
    const body = await parseWebhookBody(request);
    if (!body) {
      return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const event = normalizeEvent(body.event);
    console.log('[webhook] event:', body.event, '→ normalizado:', event);

    if (event !== 'messages.upsert') {
      console.log('[webhook] evento ignorado:', event);
      return Response.json({ ok: true, ignored: 'event' });
    }

    const data = body.data as Record<string, unknown> | undefined;
    if (!data?.key) {
      console.log('[webhook] sem data.key — ignorando');
      return Response.json({ ok: true, ignored: 'no_key' });
    }

    const key = data.key as Record<string, unknown>;
    if (key.fromMe) {
      console.log('[webhook] fromMe=true — ignorando');
      return Response.json({ ok: true, ignored: 'from_me' });
    }

    const messageId = typeof key.id === 'string' ? key.id : '';
    if (messageId && isDuplicateMessage(messageId)) {
      console.log('[webhook] msg duplicada ignorada | id:', messageId);
      return Response.json({ ok: true, ignored: 'duplicate' });
    }

    const numero = extractNumero(key);
    if (!numero) {
      console.log('[webhook] remoteJid inválido:', key.remoteJid);
      return Response.json({ ok: true, ignored: 'no_number' });
    }

    console.log('[webhook] msg de', numero, '| instance:', body.instance ?? EVOLUTION_INSTANCE);

    const instance = (body.instance as string | undefined) ?? EVOLUTION_INSTANCE;
    if (instance !== EVOLUTION_INSTANCE) {
      console.warn(
        '[webhook] instance webhook:',
        instance,
        '| EVOLUTION_INSTANCE env:',
        EVOLUTION_INSTANCE,
        '→ enviando pela instance do webhook',
      );
    }

    // ── Whitelist: ignora números não autorizados ──────────────────────────────
    const isOwner = OWNER_PHONE && numero === OWNER_PHONE;
    const isAllowed = isOwner || ALLOWED_PHONES.has(numero);
    if (!isAllowed) {
      console.log('[webhook] número não autorizado:', numero, '| owner:', OWNER_PHONE || '(vazio)');
      return Response.json({ ok: true, ignored: 'not_allowed' });
    }

    console.log('[webhook] autorizado:', isOwner ? 'owner' : 'allowed');

    const sendTarget = await resolveSendTarget(key, numero, instance, data);
    console.log('[webhook] sendTarget:', sendTarget, '| addressingMode:', key.addressingMode ?? 'n/a');

    const reply = (n: string, t: string) => enviarResposta(n, t, instance, sendTarget, key);

    // ── Documento PDF ──────────────────────────────────────────────────────────
    const message = data.message as Record<string, unknown> | undefined;
    const doc = message?.documentMessage as Record<string, unknown> | undefined;
    if (doc?.mimetype === 'application/pdf') {
      const filename = String(doc.fileName ?? `orcamento_${Date.now()}.pdf`);
      const pdfBuffer = await baixarMidiaEvolution(key, message, instance);
      if (!pdfBuffer) {
        await reply(numero, 'Recebi o PDF mas não consegui baixá-lo. Tenta enviar novamente.');
        return Response.json({ ok: true });
      }

      if (OWNER_PHONE && numero === OWNER_PHONE) {
        // Marmoraria — processa e responde diretamente no WhatsApp
        await reply(numero, '📄 PDF recebido! Processando orçamento de marmoraria... Pode levar 1-2 minutos.');
        processarPdfMarmoraria(numero, pdfBuffer, filename, sendTarget).catch((err) => {
          console.error('[webhook] erro no processamento do PDF de marmoraria:', err);
        });
      } else {
        // Marcenaria — resultado vai para o PC display via whatsapp_jobs
        await processarPdfJob(numero, instance, pdfBuffer, filename, sendTarget);
      }

      return Response.json({ ok: true });
    }

    // ── Áudio ─────────────────────────────────────────────────────────────────
    const audio = message?.audioMessage;
    if (audio) {
      const audioBuffer = await baixarMidiaEvolution(key, message, instance);
      if (audioBuffer) {
        const transcricao = await transcreverAudio(audioBuffer);
        if (transcricao) {
          const isOwnerAudio = OWNER_PHONE && numero === OWNER_PHONE;
          let resposta: string;
          if (isOwnerAudio) {
            const interceptado = await handleOwnerInterceptors(numero, transcricao, instance);
            if (interceptado !== null) {
              resposta = interceptado;
            } else {
              const historico = await carregarHistorico(numero);
              resposta = await processarComBrain(historico, transcricao, numero);
              await salvarMensagem(numero, 'user', transcricao);
              await salvarMensagem(numero, 'assistant', resposta);
            }
          } else {
            resposta = await processarMensagem(numero, `[áudio transcrito]: ${transcricao}`);
          }
          await reply(numero, resposta);
          return Response.json({ ok: true });
        }
      }
      await reply(numero, 'Recebi um áudio mas não consegui transcrever. Pode escrever?');
      return Response.json({ ok: true });
    }

    // ── Texto ─────────────────────────────────────────────────────────────────
    const extText = message?.extendedTextMessage as Record<string, unknown> | undefined;
    const texto =
      (typeof message?.conversation === 'string' ? message.conversation : null) ||
      (typeof extText?.text === 'string' ? extText.text : null);

    if (!texto) {
      const msgTypes = message ? Object.keys(message).join(', ') : '(sem message)';
      console.log('[webhook] sem texto extraível | tipos em message:', msgTypes);
      return Response.json({ ok: true, ignored: 'no_text' });
    }

    console.log('[webhook] texto:', texto.slice(0, 80));

    if (isOwner) {
      // Comando especial: conectar Google Calendar
      const textoNorm = texto.trim().toLowerCase();
      if (textoNorm === '/calendar' || textoNorm === 'conectar calendar') {
        const jaConectado = await calendarConectado();
        if (jaConectado) {
          await reply(numero, 'Google Calendar já está conectado. ✓');
        } else {
          const authUrl = getAuthUrl();
          if (authUrl) {
            await reply(numero, `Para conectar o Google Calendar, acesse:\n\n${authUrl}`);
          } else {
            await reply(numero, 'Google Calendar não configurado. Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.local.');
          }
        }
        return Response.json({ ok: true });
      }

      // ── Menu de opções ─────────────────────────────────────────────────────
      if (MENU_REGEX.test(texto)) {
        await reply(numero, gerarMensagemMenu());
        return Response.json({ ok: true });
      }

      // ── Link do dashboard ──────────────────────────────────────────────────
      if (DASHBOARD_REGEX.test(texto)) {
        await reply(numero, gerarLinkDashboard());
        return Response.json({ ok: true });
      }

      // ── Cursor SDK: edição de código via WhatsApp ──────────────────────────
      const textoTrimmed = texto.trim();
      const cursorMatch =
        textoTrimmed.match(/^cursor:\s*(.+)/is) ??
        textoTrimmed.match(/^\/cursor\s+(.+)/is);
      if (cursorMatch) {
        const instrucao = cursorMatch[1].trim();
        await reply(numero, '🤖 Entendido! Acionando o Cursor Agent...');
        executarCursorAgent(instrucao, (msg) => enviarResposta(numero, msg, instance, sendTarget, key)).catch((err) => {
          console.error('[webhook] cursor-agent background error:', err);
        });
        return Response.json({ ok: true });
      }

      // Interceptações hardcoded (prompt, CONFIRMAR, CANCELAR, delete_selection)
      const interceptado = await handleOwnerInterceptors(numero, texto, instance);
      if (interceptado !== null) {
        await reply(numero, interceptado);
        return Response.json({ ok: true });
      }

      // Brain mode: detecção de intenção + vault
      console.log('[webhook] processando com Brain (owner)...');
      const historico = await carregarHistorico(numero);
      const resposta = await processarComBrain(historico, texto, numero);

      // Persistir histórico do Brain
      await salvarMensagem(numero, 'user', texto);
      await salvarMensagem(numero, 'assistant', resposta);

      await reply(numero, resposta);
      return Response.json({ ok: true });
    }

    // ── Allowed phones: acesso Brain com dados isolados por phone ─────────────
    if (ALLOWED_PHONES.has(numero)) {
      // Menu e dashboard também disponíveis para allowed phones
      if (MENU_REGEX.test(texto)) {
        await reply(numero, gerarMensagemMenu());
        return Response.json({ ok: true });
      }

      if (DASHBOARD_REGEX.test(texto)) {
        await reply(numero, gerarLinkDashboard());
        return Response.json({ ok: true });
      }

      // Brain mode com dados isolados por phone
      const historico = await carregarHistorico(numero);
      const resposta = await processarComBrain(historico, texto, numero);
      await salvarMensagem(numero, 'user', texto);
      await salvarMensagem(numero, 'assistant', resposta);
      await reply(numero, resposta);
      return Response.json({ ok: true });
    }

    // Modo SDR Helena para leads externos — DESATIVADO TEMPORARIAMENTE
    // const resposta = await processarMensagem(numero, texto);
    // await enviarResposta(numero, resposta);
    console.log('[webhook] SDR Helena desativada. Mensagem de', numero, ':', texto);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[webhook] erro:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
