import { NextRequest, NextResponse } from 'next/server';

const PYTHON_URL = process.env.EXTRACTOR_SERVICE_URL ?? 'http://localhost:8000';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

/**
 * POST /api/competitor/scrape
 *
 * Acionado pelo Vercel Cron (vercel.json) ou manualmente.
 * Repassa o pedido ao serviço Python que faz o scraping e persiste no Supabase.
 *
 * Headers aceitos pelo Cron da Vercel:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  // Validação do segredo do cron (ignora se CRON_SECRET não estiver configurado)
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body vazio — usa env vars no Python
  }

  try {
    const pythonRes = await fetch(`${PYTHON_URL}/competitor/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Timeout generoso: instaloader pode demorar 30-60s
      signal: AbortSignal.timeout(120_000),
    });

    const data = await pythonRes.json();

    if (!pythonRes.ok) {
      return NextResponse.json(
        { error: data?.detail ?? 'Erro no serviço Python', detail: data },
        { status: pythonRes.status },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron aciona via GET quando definido em vercel.json
export async function GET(req: NextRequest) {
  return POST(req);
}
