import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/config/ai';
import { STAGE2_PROMPT } from '@/lib/orcamento/prompts';

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    const body = await request.json() as { stage1Output: string };

    if (!body.stage1Output) {
      return Response.json({ error: 'stage1Output é obrigatório' }, { status: 400 });
    }

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 50000,
      messages: [
        {
          role: 'user',
          content: body.stage1Output + '\n\n' + STAGE2_PROMPT,
        },
      ],
    });

    const output = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n');

    return Response.json({ output, usage: response.usage });
  } catch (error) {
    console.error('Stage 2 error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const detail = (error as { status?: number; error?: unknown })?.error;
    return Response.json(
      { error: msg, detail: detail ?? null },
      { status: 500 }
    );
  }
}
