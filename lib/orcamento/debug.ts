const PREFIX = '[marmoraria]';

function ts() {
  return new Date().toISOString().slice(11, 23);
}

/** Logs marmoraria pipeline events — visible in browser console and Next.js terminal (API routes). */
export function marmorariaLog(stage: string, message: string, data?: Record<string, unknown>) {
  const line = `${PREFIX} ${ts()} [${stage}] ${message}`;
  if (data && Object.keys(data).length > 0) {
    console.log(line, data);
  } else {
    console.log(line);
  }
}

export function marmorariaError(stage: string, message: string, err?: unknown) {
  const detail = err instanceof Error ? err.message : err != null ? String(err) : undefined;
  console.error(`${PREFIX} ${ts()} [${stage}] ERROR: ${message}`, detail ?? '', err ?? '');
}

/** Extrai mensagem legível de erros Anthropic (ex.: saldo zerado). */
export function formatMarmorariaApiError(raw: string): string {
  if (/credit balance is too low/i.test(raw)) {
    return 'Saldo da API Anthropic esgotado. Adicione créditos em console.anthropic.com → Plans & Billing e tente novamente.';
  }
  if (/invalid_request_error/i.test(raw) && /api[_-]?key/i.test(raw)) {
    return 'Chave da API Anthropic inválida ou ausente. Verifique ANTHROPIC_API_KEY no .env.local.';
  }
  // Evita dump de JSON inteiro na UI
  const jsonMatch = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (jsonMatch?.[1]) return jsonMatch[1];
  if (raw.length > 280) return `${raw.slice(0, 280)}…`;
  return raw;
}
