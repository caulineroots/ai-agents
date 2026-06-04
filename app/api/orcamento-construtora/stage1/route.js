import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { STAGE1_PROMPT } from '@/lib/construtora/stage1-prompt';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/orcamento-construtora/stage1
 *
 * Body (multipart/form-data):
 *   imagens: File[] — um ou mais PNGs da prancha
 *
 * Response JSON:
 *   { itens: object[], uso: object, aviso?: string }
 */
export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { erro: 'ANTHROPIC_API_KEY não configurada em .env.local' },
      { status: 500 }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ erro: 'Envie os arquivos como multipart/form-data.' }, { status: 400 });
  }

  const arquivos = formData.getAll('imagens');
  if (!arquivos || arquivos.length === 0) {
    return NextResponse.json({ erro: 'Nenhuma imagem recebida. Envie pelo menos um PNG.' }, { status: 400 });
  }

  // Converte cada arquivo para bloco de imagem Anthropic
  const blocos = [];
  for (const arquivo of arquivos) {
    if (!(arquivo instanceof File)) continue;

    const buffer = await arquivo.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mediaType = arquivo.type || 'image/png';

    blocos.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    });
  }

  if (blocos.length === 0) {
    return NextResponse.json({ erro: 'Arquivos recebidos não são imagens válidas.' }, { status: 400 });
  }

  blocos.push({
    type: 'text',
    text: arquivos.length > 1
      ? `Analise as ${arquivos.length} pranchas acima e retorne o JSON consolidado com todos os itens identificados.`
      : 'Analise a prancha acima e retorne o JSON com todos os itens identificados.',
  });

  let resposta;
  try {
    resposta = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: STAGE1_PROMPT,
      messages: [{ role: 'user', content: blocos }],
    });
  } catch (err) {
    console.error('[stage1] Anthropic error:', err);
    return NextResponse.json(
      { erro: 'Erro ao chamar a API da Anthropic.', detalhe: err.message },
      { status: 502 }
    );
  }

  const textoResposta = resposta.content?.[0]?.text ?? '';

  // Extrai o JSON da resposta (Claude às vezes envolve em ```json ... ```)
  let itens;
  try {
    const match = textoResposta.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = match ? match[1].trim() : textoResposta.trim();
    itens = JSON.parse(jsonStr);
    if (!Array.isArray(itens)) throw new Error('Resposta não é um array');
  } catch {
    // Devolve o texto bruto para depuração
    return NextResponse.json({
      erro: 'Claude não retornou JSON válido.',
      texto_bruto: textoResposta,
    }, { status: 422 });
  }

  return NextResponse.json({
    itens,
    uso: {
      input_tokens:  resposta.usage?.input_tokens,
      output_tokens: resposta.usage?.output_tokens,
    },
  });
}
