// ─── API: Orçamento C&A — Extrator Multi-fonte + IA (1 imagem por chamada) ───
// Fluxo: 1 imagem → Python service (PDF+DXF+Claude) → FolhaOrcamento via SSE

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { spawn } from 'child_process';
import path from 'path';
import { calcularOrcamento } from '@/lib/orcamento-construtora/calcular';
import type { FolhaOrcamento, ItemOrcamento, Divergencia } from '@/lib/orcamento-construtora/types';

const EXTRACTOR_URL = process.env.EXTRACTOR_SERVICE_URL ?? 'http://localhost:8000';
const SERVICE_SCRIPT = path.resolve(
  process.env.EXTRACTOR_SERVICE_PATH ??
  path.join(process.cwd(), '..', 'AI-Agents', 'extractor_service.py')
);

let _serviceBooting = false;
let _serviceReady   = false;

async function ensureServiceRunning(): Promise<void> {
  if (_serviceReady) {
    try {
      const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch { /* fall through */ }
    _serviceReady = false;
  }
  try {
    const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) { _serviceReady = true; return; }
  } catch { /* not running */ }

  if (_serviceBooting) { await waitForService(30_000); return; }

  _serviceBooting = true;
  console.log('[extractor] Iniciando serviço Python automaticamente…');

  const pythonExe = process.platform === 'win32'
    ? 'C:\\Users\\AVELL\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
    : 'python3';

  const proc = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'extractor_service:app', '--host', '0.0.0.0', '--port', '8000'],
    { cwd: path.dirname(SERVICE_SCRIPT), env: { ...process.env }, detached: false, stdio: 'ignore' }
  );
  proc.on('error', (err) => console.error('[extractor] Falha ao iniciar:', err));
  proc.unref();

  await waitForService(30_000);
  _serviceBooting = false;
  _serviceReady   = true;
}

async function waitForService(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch { /* still booting */ }
    await new Promise((res) => setTimeout(res, 800));
  }
  throw new Error('Serviço Python não respondeu após 30s.');
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll('images') as File[];

  if (files.length === 0) {
    return Response.json({ error: 'Nenhuma imagem recebida' }, { status: 400 });
  }

  // Processa apenas a primeira imagem — o frontend faz o loop por prancha
  const file = files[0];
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ step: 'extract', status: 'running', label: 'Iniciando serviço de extração…' });
        await ensureServiceRunning();

        send({ step: 'extract', status: 'running', label: 'Extraindo dados (PDF + DXF)…' });

        const fd = new FormData();
        fd.append('image', file, file.name);

        let serviceRes: Response;
        try {
          serviceRes = await fetch(`${EXTRACTOR_URL}/extrair`, { method: 'POST', body: fd });
        } catch (err) {
          throw new Error(
            `Serviço de extração indisponível (${EXTRACTOR_URL}). ` +
            `Inicie com: uvicorn extractor_service:app --port 8000\n${err}`
          );
        }

        if (!serviceRes.ok) {
          const errBody = await serviceRes.json().catch(() => ({})) as { detail?: string };
          throw new Error(errBody.detail ?? `Erro ${serviceRes.status} no serviço de extração`);
        }

        send({ step: 'extract', status: 'done' });
        send({ step: 'ai', status: 'running', label: 'Consultando IA (auditoria visual)…' });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await serviceRes.json() as Record<string, any>;
        send({ step: 'ai', status: 'done' });

        let idCounter = 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const itens: ItemOrcamento[] = (result.itens ?? []).map((it: any) => ({
          id: idCounter++,
          prancha_idx: null,
          status: (it.status ?? 'parcial') as ItemOrcamento['status'],
          ambiente: it.ambiente ?? 'Geral',
          descricao: it.descricao ?? '',
          categoria: it.categoria ?? 'outro',
          unidade: it.unidade ?? 'un',
          quantidade: Number(it.quantidade ?? 0),
          pendencias: it.pendencias ?? [],
          fonte: it.fonte ?? 'IA',
          confianca: Number(it.confianca ?? 70),
        }));

        const divergencias: Divergencia[] = (result.divergencias ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => ({
            campo: d.campo ?? '',
            valor_pdf: d.valor_pdf,
            valor_dxf: d.valor_dxf,
            valor_ia: d.valor_ia,
            recomendacao: d.recomendacao ?? '',
          })
        );

        const folha: FolhaOrcamento = {
          projeto: result.projeto ?? 'Projeto',
          cliente: result.cliente ?? '',
          itens,
          divergencias,
          erros_ia: result.erros_ia ?? [],
        };

        const calculado = calcularOrcamento(folha);

        send({
          step: 'done',
          folha,
          resultado: calculado,
          classificacao: result.classificacao,
          fontes_usadas: result.fontes_usadas,
          prancha: result.prancha,
          metadata: result.metadata,
          usages: [{
            label: 'Extração + IA',
            usage: {
              input_tokens: result.metadata?.tokens_input ?? 0,
              output_tokens: result.metadata?.tokens_output ?? 0,
            },
          }],
        });

      } catch (error) {
        send({ step: 'error', error: error instanceof Error ? error.message : String(error) });
      }

      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
