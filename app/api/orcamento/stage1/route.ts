import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/config/ai';
import { STAGE1_PROMPT } from '@/lib/orcamento/prompts';

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFiles = formData.getAll('images') as File[];

    if (!imageFiles || imageFiles.length === 0) {
      return Response.json({ error: 'Nenhuma imagem recebida' }, { status: 400 });
    }

    const imageContents: Anthropic.ImageBlockParam[] = await Promise.all(
      imageFiles.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mediaType = file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')
          ? 'image/jpeg' as const
          : 'image/png' as const;
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data: base64,
          },
        };
      })
    );

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            { type: 'text', text: STAGE1_PROMPT },
          ],
        },
      ],
    });

    const output = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');

    return Response.json({ output, usage: response.usage, thinking: null });
  } catch (error) {
    console.error('Stage 1 error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const detail = (error as { status?: number; error?: unknown })?.error;
    return Response.json(
      { error: msg, detail: detail ?? null },
      { status: 500 }
    );
  }
}
