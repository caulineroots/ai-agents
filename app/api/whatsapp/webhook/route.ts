import { processarMensagem, carregarHistorico } from '@/lib/whatsapp/bot';
import { processarPdfMarcenaria } from '@/lib/whatsapp/marcenaria-job';
import { processarComBrain } from '@/lib/whatsapp/intent';
import { getAuthUrl, calendarConectado } from '@/lib/whatsapp/calendar';
import { supabase } from '@/lib/supabase/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const OWNER_PHONE = process.env.OWNER_PHONE ?? '';

// Obrigatório: canvas não funciona no Edge runtime
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
    if (!res.ok) return null;
    const json = (await res.json()) as { base64?: string };
    if (!json.base64) return null;
    return Buffer.from(json.base64, 'base64');
  } catch {
    return null;
  }
}

async function transcreverAudio(audioBuffer: Buffer): Promise<string | null> {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return null;

    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'pt');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { text?: string };
    return json.text ?? null;
  } catch {
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

  // Fire & forget — não bloqueia o retorno do webhook
  processarPdfMarcenaria(job.id, pdfBuffer, safeName).catch((err) => {
    console.error('[webhook] erro no processamento do PDF:', err);
  });
}

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
      await processarPdfJob(numero, instance, pdfBuffer, filename);
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
            const historico = await carregarHistorico(numero);
            resposta = await processarComBrain(historico, transcricao);
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

    // Modo Brain para o dono — roteado pelo OWNER_PHONE
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

      // Brain mode: detecção de intenção + vault
      const historico = await carregarHistorico(numero);
      const resposta = await processarComBrain(historico, texto);
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
