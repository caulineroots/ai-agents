import { processarMensagem } from '@/lib/whatsapp/bot';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;

async function enviarResposta(numero: string, texto: string) {
  await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify({ number: numero, text: texto }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Estrutura do webhook da Evolution API v2
    const event = body?.event;
    const data = body?.data;

    // Só processa mensagens recebidas (ignora enviadas pelo próprio bot)
    if (event !== 'messages.upsert') return Response.json({ ok: true });
    if (!data?.key || data.key.fromMe) return Response.json({ ok: true });

    // Só processa texto simples por enquanto
    const texto = data?.message?.conversation || data?.message?.extendedTextMessage?.text;
    if (!texto) return Response.json({ ok: true });

    const numero = data.key.remoteJid?.replace('@s.whatsapp.net', '');
    if (!numero) return Response.json({ ok: true });

    // Processa com Claude e envia resposta
    const resposta = await processarMensagem(numero, texto);
    await enviarResposta(numero, resposta);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[webhook] erro:', error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
