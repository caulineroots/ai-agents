/**
 * Helpers compartilhados para rotear requisições ao serviço Python (FastAPI).
 */

import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const PYTHON_URL   = process.env.EXTRACTOR_SERVICE_URL ?? 'http://localhost:8000';
const STARTUP_MS   = 15_000;
const HEALTH_TRIES = 20;

let _startPromise = null;

async function isAlive() {
  try {
    const r = await fetch(`${PYTHON_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitForService(ms = STARTUP_MS) {
  const deadline = Date.now() + ms;
  for (let i = 0; i < HEALTH_TRIES; i++) {
    if (await isAlive()) return true;
    if (Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, ms / HEALTH_TRIES));
  }
  return false;
}

function startPython() {
  if (_startPromise) return _startPromise;
  _startPromise = (async () => {
    if (await isAlive()) return true;
    const cwd = path.join(process.cwd());
    const proc = spawn(
      'python', ['-m', 'uvicorn', 'extractor_service:app', '--host', '0.0.0.0', '--port', '8000'],
      { cwd, detached: true, stdio: 'ignore' }
    );
    proc.unref();
    const ok = await waitForService(STARTUP_MS);
    _startPromise = null;
    return ok;
  })();
  return _startPromise;
}

export async function ensureServiceRunning() {
  if (await isAlive()) return true;
  return startPython();
}

/**
 * Proxy genérico: forwarda a request multipart para o Python e devolve a resposta.
 */
export async function proxyToPython(request, endpoint, { timeoutMs = 120_000 } = {}) {
  const up = await ensureServiceRunning();
  if (!up) {
    return NextResponse.json(
      { erro: 'Serviço Python não disponível. Inicie-o manualmente: uvicorn extractor_service:app --port 8000' },
      { status: 503 }
    );
  }

  const url = `${PYTHON_URL}${endpoint}`;
  const headers = {};
  const ct = request.headers.get('content-type');
  if (ct) headers['content-type'] = ct;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body: request.body,
      duplex: 'half',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return NextResponse.json({ erro: `Erro ao chamar Python: ${err.message}` }, { status: 502 });
  }

  const body = await resp.text();
  return new NextResponse(body, {
    status: resp.status,
    headers: { 'content-type': resp.headers.get('content-type') ?? 'application/json' },
  });
}
