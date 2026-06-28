/**
 * _python-service.ts — helper compartilhado pelas rotas que proxeiam o Python.
 *
 * Usa globalThis para compartilhar estado entre módulos distintos do Next.js
 * (cada rota é um módulo separado, então variáveis de módulo não são compartilhadas).
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';

const EXTRACTOR_URL = process.env.EXTRACTOR_SERVICE_URL ?? 'http://localhost:8000';
const SERVICE_SCRIPT = path.resolve(
  process.env.EXTRACTOR_SERVICE_PATH ??
  path.join(process.cwd(), 'extractor_service.py'),
);

/** Tempo máximo aguardando uvicorn responder em /health (boot). */
const BOOT_TIMEOUT_MS = Number(process.env.PYTHON_BOOT_TIMEOUT_MS ?? 180_000);
/** Timeout de cada ping /health durante o boot. */
const HEALTH_CHECK_MS = Number(process.env.PYTHON_HEALTH_TIMEOUT_MS ?? 5_000);
/** Timeout da requisição proxy → Python (extração de PDF). */
const PROXY_TIMEOUT_MS = Number(process.env.PYTHON_PROXY_TIMEOUT_MS ?? 280_000);

function log(msg: string, extra?: Record<string, unknown>) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
  console.log(`[python-service] ${msg}${suffix}`);
}

function logErr(msg: string, extra?: Record<string, unknown>) {
  const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
  console.error(`[python-service] ${msg}${suffix}`);
}

function resolvePythonExe(): string {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  if (process.platform === 'win32') {
    return 'C:\\Users\\AVELL\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';
  }
  return 'python3';
}

// Shared state across all route modules via globalThis
const G = globalThis as typeof globalThis & {
  _pyBooting?: boolean;
  _pyReady?: boolean;
  _pyProc?: ChildProcess | null;
};
if (G._pyBooting === undefined) G._pyBooting = false;
if (G._pyReady   === undefined) G._pyReady   = false;
if (G._pyProc    === undefined) G._pyProc    = null;

async function isAlive(): Promise<boolean> {
  try {
    const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(HEALTH_CHECK_MS) });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitForService(timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  log(`Aguardando Python (${label})`, { url: EXTRACTOR_URL, timeoutSec: Math.round(timeoutMs / 1000) });

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const r = await fetch(`${EXTRACTOR_URL}/health`, { signal: AbortSignal.timeout(HEALTH_CHECK_MS) });
      if (r.ok) {
        log(`Python respondeu /health`, { attempt, elapsedSec: Math.round((Date.now() - (deadline - timeoutMs)) / 1000) });
        return;
      }
      if (attempt === 1 || attempt % 10 === 0) {
        log(`Health check ainda não OK`, { attempt, status: r.status });
      }
    } catch (err) {
      if (attempt === 1 || attempt % 10 === 0) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`Health check falhou`, { attempt, error: msg });
      }
    }
    await new Promise((res) => setTimeout(res, 1_000));
  }

  throw new Error(`Serviço Python não respondeu após ${Math.round(timeoutMs / 1000)}s (${label}).`);
}

function attachProcessLogs(proc: ChildProcess) {
  proc.stdout?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      log(`uvicorn | ${line}`);
    }
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      logErr(`uvicorn | ${line}`);
    }
  });
  proc.on('exit', (code, signal) => {
    logErr('Processo uvicorn encerrou', { code, signal });
    G._pyReady = false;
    G._pyBooting = false;
    G._pyProc = null;
  });
}

export async function ensureServiceRunning(): Promise<void> {
  if (G._pyReady) return;

  if (await isAlive()) {
    log('Python já está rodando', { url: EXTRACTOR_URL });
    G._pyReady = true;
    return;
  }

  if (G._pyBooting) {
    await waitForService(BOOT_TIMEOUT_MS, 'boot em andamento');
    G._pyReady = true;
    return;
  }

  G._pyBooting = true;
  const pythonExe = resolvePythonExe();
  const cwd = path.dirname(SERVICE_SCRIPT);

  log('Iniciando serviço Python', {
    pythonExe,
    cwd,
    script: SERVICE_SCRIPT,
    url: EXTRACTOR_URL,
    bootTimeoutSec: Math.round(BOOT_TIMEOUT_MS / 1000),
  });

  if (!G._pyProc || G._pyProc.killed || G._pyProc.exitCode !== null) {
    const proc = spawn(
      pythonExe,
      ['-m', 'uvicorn', 'extractor_service:app', '--host', '0.0.0.0', '--port', '8000'],
      { cwd, env: { ...process.env }, detached: false, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    G._pyProc = proc;

    proc.on('error', (err) => {
      logErr('Falha ao spawn uvicorn', { message: err.message, pythonExe, cwd });
      G._pyBooting = false;
      G._pyReady = false;
    });

    attachProcessLogs(proc);
  }

  try {
    await waitForService(BOOT_TIMEOUT_MS, 'após spawn');
    G._pyReady = true;
    log('Python pronto');
  } catch (err) {
    G._pyReady = false;
    throw err;
  } finally {
    G._pyBooting = false;
  }
}

export async function proxyToPython(
  request: Request,
  endpoint: string,
): Promise<Response> {
  const t0 = Date.now();
  log(`→ POST ${endpoint}`, { proxyTimeoutSec: Math.round(PROXY_TIMEOUT_MS / 1000) });

  try {
    await ensureServiceRunning();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Serviço Python indisponível';
    logErr(`Boot falhou para ${endpoint}`, { error: msg, elapsedMs: Date.now() - t0 });
    return Response.json({ error: msg }, { status: 503 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  try {
    const res = await fetch(`${EXTRACTOR_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: request.body,
      // @ts-expect-error — Node fetch aceita duplex
      duplex: 'half',
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      logErr(`Resposta não-JSON de POST ${endpoint}`, {
        status: res.status,
        bodyPreview: text.slice(0, 300),
        elapsedMs: Date.now() - t0,
      });
      return Response.json(
        { error: text.slice(0, 500) || `HTTP ${res.status}` },
        { status: res.status >= 400 ? res.status : 502 },
      );
    }
    log(`← POST ${endpoint}`, { status: res.status, elapsedMs: Date.now() - t0 });
    return Response.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnErr = msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET')
                   || msg.includes('ENOTFOUND')    || msg.includes('fetch failed');
    if (isConnErr) G._pyReady = false;
    const status = msg.includes('TimeoutError') || msg.includes('AbortError') ? 504 : 502;
    logErr(`Erro em POST ${endpoint}`, { error: msg, status, elapsedMs: Date.now() - t0, isConnErr });
    return Response.json({ error: `Erro ao chamar Python: ${msg}` }, { status });
  }
}
