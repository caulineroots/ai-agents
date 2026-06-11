/**
 * _python-service.ts — helper compartilhado pelas rotas que proxeiam o Python.
 *
 * Usa globalThis para compartilhar estado entre módulos distintos do Next.js
 * (cada rota é um módulo separado, então variáveis de módulo não são compartilhadas).
 */

import { spawn } from 'child_process';
import path from 'path';

const EXTRACTOR_URL  = process.env.EXTRACTOR_SERVICE_URL ?? 'http://localhost:8000';
const SERVICE_SCRIPT = path.resolve(
  process.env.EXTRACTOR_SERVICE_PATH ??
  path.join(process.cwd(), 'extractor_service.py'),
);

// Shared state across all route modules via globalThis
const G = globalThis as typeof globalThis & {
  _pyBooting?: boolean;
  _pyReady?:   boolean;
};
if (G._pyBooting === undefined) G._pyBooting = false;
if (G._pyReady   === undefined) G._pyReady   = false;

async function isAlive(): Promise<boolean> {
  try {
    const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

async function waitForService(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch { /* ainda subindo */ }
    await new Promise((res) => setTimeout(res, 800));
  }
  throw new Error('Serviço Python não respondeu após timeout.');
}

export async function ensureServiceRunning(): Promise<void> {
  // Se já confirmamos que está rodando, confiamos no flag — não pingamos toda chamada.
  // Se uma requisição falhar depois, proxyToPython redefine _pyReady=false para forçar
  // o recheck na próxima tentativa.
  if (G._pyReady) return;

  if (await isAlive()) { G._pyReady = true; return; }
  if (G._pyBooting)   { await waitForService(60_000); G._pyReady = true; return; }

  G._pyBooting = true;
  console.log('[python-service] Iniciando serviço Python…');

  const pythonExe = process.env.EXTRACTOR_PYTHON
    ?? (process.platform === 'win32'
      ? 'C:\\Users\\AVELL\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
      : 'python3');

  const proc = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'extractor_service:app', '--host', '0.0.0.0', '--port', '8000'],
    { cwd: path.dirname(SERVICE_SCRIPT), env: { ...process.env }, detached: false, stdio: 'ignore' },
  );
  proc.on('error', (err) => {
    console.error('[python-service] Falha ao iniciar:', err);
    G._pyBooting = false;
  });
  proc.unref();

  try {
    await waitForService(60_000);
    G._pyReady   = true;
  } finally {
    G._pyBooting = false;
  }
}

export async function proxyToPython(
  request: Request,
  endpoint: string,
): Promise<Response> {
  try {
    await ensureServiceRunning();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Serviço Python indisponível' },
      { status: 503 },
    );
  }

  const contentType = request.headers.get('content-type') ?? '';
  try {
    const res = await fetch(`${EXTRACTOR_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: request.body,
      // @ts-expect-error — Node fetch aceita duplex
      duplex: 'half',
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    G._pyReady = false; // força recheck na próxima chamada
    return Response.json({ error: `Erro ao chamar Python: ${err}` }, { status: 502 });
  }
}
