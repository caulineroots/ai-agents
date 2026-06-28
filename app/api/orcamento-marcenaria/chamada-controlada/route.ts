import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/config/ai';
import { calcularOrcamento } from '@/lib/orcamento-marcenaria/calcular';
import { getPrompt1, buildReviewPromptFromDB } from '@/lib/orcamento-marcenaria/prompts';
import type { FolhaMedicao } from '@/lib/orcamento-marcenaria/types';

const client = new Anthropic();

function getMediaType(filename: string): 'image/jpeg' | 'image/png' {
  const lower = filename.toLowerCase();
  return (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) ? 'image/jpeg' : 'image/png';
}

async function buildImageBlocks(files: File[], pageTexts: string[]): Promise<Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>> {
  const blocks: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    if (files.length > 1) {
      blocks.push({ type: 'text', text: `--- Prancha ${idx + 1} de ${files.length} ---` });
    }
    const pageText = (pageTexts[idx] ?? '').trim();
    if (pageText) {
      blocks.push({
        type: 'text',
        text: `[CAMADA DE TEXTO PDF — Prancha ${idx + 1}]\n${pageText}`,
      });
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: getMediaType(file.name), data: base64 },
    } satisfies Anthropic.ImageBlockParam);
  }
  return blocks;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];
    const pageTexts = formData.getAll('pageTexts') as string[];

    if (files.length === 0) {
      return Response.json({ error: 'Nenhuma imagem recebida' }, { status: 400 });
    }

    const [imageBlocks, prompt1] = await Promise.all([
      buildImageBlocks(files, pageTexts),
      getPrompt1(),
    ]);

    const res1 = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: prompt1 }] }],
    });
    const output1 = res1.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');

    const reviewPrompt = await buildReviewPromptFromDB(output1);

    const res2 = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [
        { role: 'user', content: [...imageBlocks, { type: 'text', text: prompt1 }] },
        { role: 'assistant', content: output1 },
        { role: 'user', content: reviewPrompt },
      ],
    });
    const output2 = res2.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');

    let folha: FolhaMedicao | null = null;
    let resultado = null;
    let parseError: string | null = null;
    try {
      const jsonMatch = output2.match(/```(?:json)?\s*([\s\S]*?)```/g);
      let jsonRaw = '';
      if (jsonMatch) {
        jsonRaw = jsonMatch[jsonMatch.length - 1]
          .replace(/^```(?:json)?\s*/, '')
          .replace(/\s*```$/, '')
          .trim();
      } else {
        const start = output2.indexOf('{');
        const end = output2.lastIndexOf('}');
        if (start !== -1 && end !== -1) jsonRaw = output2.slice(start, end + 1);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = JSON.parse(jsonRaw) as { projeto: string; itens: any[] };

      folha = {
        projeto: raw.projeto,
        itens: raw.itens.map((item) => {
          const c = Number(item.comprimento_m ?? 0);
          const l = Number(item.largura_m ?? 0);
          const aiArea = Number(item.area_m2 ?? 0);
          return {
            ...item,
            comprimento_m: c,
            largura_m: l,
            area_m2: aiArea > 0 ? parseFloat(aiArea.toFixed(4)) : parseFloat((c * l).toFixed(4)),
          };
        }),
      } as FolhaMedicao;

      resultado = calcularOrcamento(folha);
    } catch (e) {
      parseError = `Erro ao interpretar JSON: ${e instanceof Error ? e.message : String(e)}`;
    }

    return Response.json({
      output1,
      output2,
      folha,
      resultado,
      parseError,
      usage1: res1.usage,
      usage2: res2.usage,
    });
  } catch (error) {
    console.error('Chamada controlada marcenaria error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const detail = (error as { status?: number; error?: unknown })?.error;
    return Response.json({ error: msg, detail: detail ?? null }, { status: 500 });
  }
}
