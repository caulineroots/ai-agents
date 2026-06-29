import { processarMensagem, carregarHistorico, salvarMensagem } from '@/lib/whatsapp/bot';
import { processarPdfMarcenaria } from '@/lib/whatsapp/marcenaria-job';
import { processarPdfMarmoraria } from '@/lib/whatsapp/marmoraria-job';
import { processarComBrain } from '@/lib/whatsapp/intent';
import { getAuthUrl, calendarConectado } from '@/lib/whatsapp/calendar';
import { supabase } from '@/lib/supabase/client';
import { getPrompt, setPrompt, listPrompts } from '@/lib/whatsapp/prompts-db';
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

async function enviarResposta(numero: string, texto: string) {
  try {
    await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: numero, text: texto }),
    });
  } catch (err) {
    console.error('[webhook] erro ao enviar resposta:', err);
  }
}

async function baixarMidiaEvolution(messageKey: unknown, message: unknown): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
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
  );

  processarPdfMarcenaria(job.id, pdfBuffer, safeName).catch((err) => {
    console.error('[webhook] erro no processamento do PDF:', err);
  });
}

// ─── Interceptações hardcoded para o OWNER ───────────────────────────────────

async function handleOwnerInterceptors(
  numero: string,
  texto: string,
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
      await enviarResposta(numero, `[${nome} — parte ${i + 1}/${chunks.length}]\n\n${chunks[i]}`);
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const event = body?.event;
    const data = body?.data;

    if (event !== 'messages.upsert') return Response.json({ ok: true });
    if (!data?.key || data.key.fromMe) return Response.json({ ok: true });

    const numero = data.key.remoteJid?.replace('@s.whatsapp.net', '');
    if (!numero) return Response.json({ ok: true });

    const instance = body?.instance ?? EVOLUTION_INSTANCE;

    // ── Documento PDF ──────────────────────────────────────────────────────────
    const doc = data?.message?.documentMessage;
    if (doc?.mimetype === 'application/pdf') {
      const filename = doc.fileName ?? `orcamento_${Date.now()}.pdf`;
      const pdfBuffer = await baixarMidiaEvolution(data.key, data.message);
      if (!pdfBuffer) {
        await enviarResposta(numero, 'Recebi o PDF mas não consegui baixá-lo. Tenta enviar novamente.');
        return Response.json({ ok: true });
      }

      if (OWNER_PHONE && numero === OWNER_PHONE) {
        // Marmoraria — processa e responde diretamente no WhatsApp
        await enviarResposta(numero, '📄 PDF recebido! Processando orçamento de marmoraria... Pode levar 1-2 minutos.');
        processarPdfMarmoraria(numero, pdfBuffer, filename).catch((err) => {
          console.error('[webhook] erro no processamento do PDF de marmoraria:', err);
        });
      } else {
        // Marcenaria — resultado vai para o PC display via whatsapp_jobs
        await processarPdfJob(numero, instance, pdfBuffer, filename);
      }

      return Response.json({ ok: true });
    }

    // ── Áudio ─────────────────────────────────────────────────────────────────
    const audio = data?.message?.audioMessage;
    if (audio) {
      const audioBuffer = await baixarMidiaEvolution(data.key, data.message);
      if (audioBuffer) {
        const transcricao = await transcreverAudio(audioBuffer);
        if (transcricao) {
          const isOwnerAudio = OWNER_PHONE && numero === OWNER_PHONE;
          let resposta: string;
          if (isOwnerAudio) {
            const interceptado = await handleOwnerInterceptors(numero, transcricao);
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
          await enviarResposta(numero, resposta);
          return Response.json({ ok: true });
        }
      }
      await enviarResposta(numero, 'Recebi um áudio mas não consegui transcrever. Pode escrever?');
      return Response.json({ ok: true });
    }

    // ── Texto ─────────────────────────────────────────────────────────────────
    const texto = data?.message?.conversation || data?.message?.extendedTextMessage?.text;
    if (!texto) return Response.json({ ok: true });

    const isOwner = OWNER_PHONE && numero === OWNER_PHONE;

    if (isOwner) {
      // Comando especial: conectar Google Calendar
      const textoNorm = texto.trim().toLowerCase();
      if (textoNorm === '/calendar' || textoNorm === 'conectar calendar') {
        const jaConectado = await calendarConectado();
        if (jaConectado) {
          await enviarResposta(numero, 'Google Calendar já está conectado. ✓');
        } else {
          const authUrl = getAuthUrl();
          if (authUrl) {
            await enviarResposta(numero, `Para conectar o Google Calendar, acesse:\n\n${authUrl}`);
          } else {
            await enviarResposta(numero, 'Google Calendar não configurado. Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.local.');
          }
        }
        return Response.json({ ok: true });
      }

      // Interceptações hardcoded (prompt, CONFIRMAR, CANCELAR, delete_selection)
      const interceptado = await handleOwnerInterceptors(numero, texto);
      if (interceptado !== null) {
        await enviarResposta(numero, interceptado);
        return Response.json({ ok: true });
      }

      // Brain mode: detecção de intenção + vault
      const historico = await carregarHistorico(numero);
      const resposta = await processarComBrain(historico, texto, numero);

      // Persistir histórico do Brain
      await salvarMensagem(numero, 'user', texto);
      await salvarMensagem(numero, 'assistant', resposta);

      await enviarResposta(numero, resposta);
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
