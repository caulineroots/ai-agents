import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { STAGE1_PROMPT } from '@/lib/construtora/stage1-prompt';
import { calcularOrcamento } from '@/lib/construtora/calcular-orcamento';

const MODEL = 'claude-sonnet-4-6';

const REVIEW_PROMPT = `Você recebeu a análise acima de um projeto de fit-out comercial.

Sua tarefa agora é:
1. Revisar e corrigir os itens identificados (dimensões, unidades, códigos)
2. Verificar se faltou algum item visível nas pranchas
3. Retornar SOMENTE um array JSON limpo, sem texto antes ou depois

O JSON deve seguir EXATAMENTE este schema por item:
{
  "cod": string | null,
  "descricao": string,
  "ambiente": string,
  "unid": string,
  "L": number | null,
  "C": number | null,
  "qty": number | null,
  "material_cliente": boolean,
  "status": "confirmado" | "estimativa" | "pendencia",
  "observacao": string | null
}

Retorne APENAS o array JSON. Nenhum texto antes, nenhum depois.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildImageBlocks(files, nomesPranchas) {
  const blocks = [];
  for (let i = 0; i < files.length; i++) {
    if (files.length > 1) {
      blocks.push({ type: 'text', text: `--- Prancha ${i + 1} de ${files.length}${nomesPranchas[i] ? ` — ${nomesPranchas[i]}` : ''} ---` });
    }
    blocks.push(files[i]);
  }
  return blocks;
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ erro: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 });
  }

  let formData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ erro: 'Envie multipart/form-data.' }, { status: 400 }); }

  const arquivos = formData.getAll('images');
  if (!arquivos?.length) return NextResponse.json({ erro: 'Nenhuma imagem recebida.' }, { status: 400 });

  const imageBlocks = [];
  const nomes = [];
  for (const arq of arquivos) {
    if (!(arq instanceof File)) continue;
    const buf = await arq.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: arq.type || 'image/jpeg', data: b64 } });
    nomes.push(arq.name);
  }

  if (!imageBlocks.length) return NextResponse.json({ erro: 'Arquivos inválidos.' }, { status: 400 });

  const blocos = buildImageBlocks(imageBlocks, nomes);

  // ── Chamada 1 — Scanner inicial ─────────────────────────────────────────────
  let res1;
  try {
    res1 = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: [...blocos, { type: 'text', text: STAGE1_PROMPT }] }],
    });
  } catch (err) {
    console.error('[chamada-controlada] Chamada 1 erro:', err);
    return NextResponse.json({ erro: 'Erro na chamada 1 à Anthropic.', detalhe: err.message }, { status: 502 });
  }

  const output1 = res1.content?.filter((b) => b.type === 'text').map((b) => b.text).join('\n') ?? '';

  // ── Chamada 2 — Revisão + JSON limpo ────────────────────────────────────────
  let res2;
  try {
    res2 = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        { role: 'user', content: [...blocos, { type: 'text', text: STAGE1_PROMPT }] },
        { role: 'assistant', content: output1 },
        { role: 'user', content: REVIEW_PROMPT },
      ],
    });
  } catch (err) {
    console.error('[chamada-controlada] Chamada 2 erro:', err);
    return NextResponse.json({ erro: 'Erro na chamada 2 à Anthropic.', detalhe: err.message }, { status: 502 });
  }

  const output2 = res2.content?.filter((b) => b.type === 'text').map((b) => b.text).join('\n') ?? '';

  // ── Parse JSON + cálculo ────────────────────────────────────────────────────
  let itens = null;
  let resultado = null;
  let parseError = null;

  try {
    const match = output2.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = match ? match[1].trim() : output2.trim();
    itens = JSON.parse(jsonStr);
    if (!Array.isArray(itens)) throw new Error('Resposta não é array');
    resultado = calcularOrcamento(itens, { nomeObra: nomes[0]?.replace(/\.\w+$/, '') ?? 'Obra' });
  } catch (e) {
    parseError = `Erro ao interpretar JSON: ${e.message}`;
    // Tenta extrair o JSON de output1 como fallback
    try {
      const match1 = output1.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr1 = match1 ? match1[1].trim() : null;
      if (jsonStr1) {
        itens = JSON.parse(jsonStr1);
        if (!Array.isArray(itens)) throw new Error('Fallback não é array');
        resultado = calcularOrcamento(itens, { nomeObra: nomes[0]?.replace(/\.\w+$/, '') ?? 'Obra' });
        parseError = `(Fallback para output1) ${parseError}`;
      }
    } catch { /* ignora */ }
  }

  return NextResponse.json({
    output1,
    output2,
    itens,
    resultado,
    parseError,
    usage1: { input_tokens: res1.usage?.input_tokens, output_tokens: res1.usage?.output_tokens },
    usage2: { input_tokens: res2.usage?.input_tokens, output_tokens: res2.usage?.output_tokens },
  });
}
