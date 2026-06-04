// ─── API: Banco de Nomenclaturas — proxy para o serviço Python ───────────────
// Repassa chamadas para os endpoints /aprender/* do extractor_service

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { spawn } from 'child_process';
import path from 'path';

const EXTRACTOR_URL = process.env.EXTRACTOR_SERVICE_URL ?? 'http://localhost:8000';
const SERVICE_SCRIPT = path.resolve(
  process.env.EXTRACTOR_SERVICE_PATH ??
  path.join(process.cwd(), '..', 'AI-Agents', 'extractor_service.py')
);

let _serviceReady = false;
let _serviceBooting = false;

async function ensureServiceRunning(): Promise<void> {
  if (_serviceReady) {
    try {
      const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch { _serviceReady = false; }
  }
  try {
    const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) { _serviceReady = true; return; }
  } catch { /* not running */ }

  if (_serviceBooting) { await waitForService(60_000); return; }
  _serviceBooting = true;

  const pythonExe = process.platform === 'win32'
    ? 'C:\\Users\\AVELL\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
    : 'python3';

  const proc = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'extractor_service:app', '--host', '0.0.0.0', '--port', '8000'],
    { cwd: path.dirname(SERVICE_SCRIPT), env: { ...process.env }, detached: false, stdio: 'ignore' }
  );
  proc.on('error', (err) => console.error('[aprender] Falha ao iniciar serviço:', err));
  proc.unref();

  await waitForService(60_000);
  _serviceBooting = false;
  _serviceReady = true;
}

async function waitForService(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return;
    } catch { /* still booting */ }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`Serviço Python não respondeu após ${Math.round(timeoutMs / 1000)}s.`);
}

// Extrai a ação da query string: ?action=analisar|ia-sugerir|atualizar|verificar|banco
function getAction(url: string): string {
  const { searchParams } = new URL(url);
  return searchParams.get('action') ?? 'banco';
}

export async function GET(request: Request) {
  try {
    await ensureServiceRunning();
    const action = getAction(request.url);
    const res = await fetch(`${EXTRACTOR_URL}/aprender/${action}`, {
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch {
      return Response.json({ error: `Serviço retornou: ${text.slice(0, 200)}` }, { status: 500 });
    }
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureServiceRunning();
    const action = getAction(request.url);

    const contentType = request.headers.get('content-type') ?? '';
    let res: Response;

    if (contentType.includes('multipart/form-data')) {
      // Encaminha o body bruto sem fazer parse no Next.js (evita limite de 1MB)
      // O Python recebe o multipart diretamente com o boundary correto
      res = await fetch(`${EXTRACTOR_URL}/aprender/${action}`, {
        method: 'POST',
        // @ts-expect-error — Node.js fetch aceita ReadableStream com duplex
        body: request.body,
        headers: { 'content-type': contentType },
        duplex: 'half',
        signal: AbortSignal.timeout(90_000),
      });
    } else {
      // JSON — lê como texto e repassa
      const text = await request.text();
      res = await fetch(`${EXTRACTOR_URL}/aprender/${action}`, {
        method: 'POST',
        body: text,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90_000),
      });
    }

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return Response.json({ error: `Serviço retornou erro: ${text.slice(0, 300)}` }, { status: 500 });
    }
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
