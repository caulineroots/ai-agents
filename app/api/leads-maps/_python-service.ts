/**
 * Helpers for proxying to the Python extractor service (Maps leads).
 */

import { spawn } from 'child_process';
import path from 'path';

const EXTRACTOR_URL = process.env.EXTRACTOR_SERVICE_URL ?? 'http://localhost:8000';
const SERVICE_SCRIPT = path.resolve(
  process.env.EXTRACTOR_SERVICE_PATH ??
  path.join(process.cwd(), 'extractor_service.py'),
);

const G = globalThis as typeof globalThis & {
  _pyBooting?: boolean;
  _pyReady?: boolean;
};
if (G._pyBooting === undefined) G._pyBooting = false;
if (G._pyReady === undefined) G._pyReady = false;

async function isAlive(): Promise<boolean> {
  try {
    const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitForService(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch {
      /* still starting */
    }
    await new Promise((res) => setTimeout(res, 800));
  }
  throw new Error('Serviço Python não respondeu após timeout.');
}

export async function ensureServiceRunning(): Promise<void> {
  if (G._pyReady) return;
  if (await isAlive()) {
    G._pyReady = true;
    return;
  }
  if (G._pyBooting) {
    await waitForService(60_000);
    G._pyReady = true;
    return;
  }

  G._pyBooting = true;
  console.log('[leads-maps] Iniciando serviço Python…');

  const pythonExe =
    process.platform === 'win32'
      ? 'C:\\Users\\AVELL\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'
      : 'python3';

  const proc = spawn(
    pythonExe,
    ['-m', 'uvicorn', 'extractor_service:app', '--host', '0.0.0.0', '--port', '8000'],
    { cwd: path.dirname(SERVICE_SCRIPT), env: { ...process.env }, detached: false, stdio: 'ignore' },
  );
  proc.on('error', (err) => {
    console.error('[leads-maps] Falha ao iniciar Python:', err);
    G._pyBooting = false;
  });
  proc.unref();

  try {
    await waitForService(60_000);
    G._pyReady = true;
  } finally {
    G._pyBooting = false;
  }
}

export async function proxyPostToPython(
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

  const contentType = request.headers.get('content-type') ?? 'application/json';
  try {
    const res = await fetch(`${EXTRACTOR_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: request.body,
      // @ts-expect-error — Node fetch duplex
      duplex: 'half',
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnErr =
      msg.includes('ECONNREFUSED') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('fetch failed');
    if (isConnErr) G._pyReady = false;
    return Response.json({ error: `Erro ao chamar Python: ${msg}` }, { status: 502 });
  }
}

export async function proxyGetToPython(endpoint: string): Promise<Response> {
  try {
    await ensureServiceRunning();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Serviço Python indisponível' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${EXTRACTOR_URL}${endpoint}`, {
      method: 'GET',
      signal: AbortSignal.timeout(30_000),
    });

    if (endpoint.endsWith('/csv')) {
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        return Response.json(data, { status: res.status });
      }
      const blob = await res.blob();
      const contentType = res.headers.get('content-type') ?? 'text/csv';
      const disposition = res.headers.get('content-disposition');
      const headers = new Headers({ 'Content-Type': contentType });
      if (disposition) headers.set('Content-Disposition', disposition);
      return new Response(blob, { status: res.status, headers });
    }

    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) G._pyReady = false;
    return Response.json({ error: `Erro ao chamar Python: ${msg}` }, { status: 502 });
  }
}
