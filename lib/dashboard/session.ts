/**
 * Helpers de sessao do dashboard usando Web Crypto API (crypto.subtle).
 * Compativel com Edge Runtime (middleware Next.js) e Node.js.
 * Formato do cookie: btoa(phone:exp).HMAC-SHA256-hex
 */

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function getSecret(): string {
  return process.env.DASHBOARD_SECRET ?? 'cauline-default-secret-change-me';
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSession(phone: string): Promise<string> {
  const exp = Date.now() + SESSION_DURATION_MS;
  const payload = `${phone}:${exp}`;
  const sig = await hmacSign(payload, getSecret());
  return `${btoa(payload)}.${sig}`;
}

/**
 * Valida o cookie e retorna o phone, ou null se invalido/expirado.
 * Aceita cookie legado (senha plain-text) retornando OWNER_PHONE.
 */
export async function getSessionPhone(cookieValue: string | undefined): Promise<string | null> {
  if (!cookieValue) return null;

  // Backward compat: cookie legado e apenas a senha
  const password = process.env.DASHBOARD_PASSWORD ?? 'cauline2026';
  if (cookieValue === password) {
    return process.env.OWNER_PHONE ?? 'owner';
  }

  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx === -1) return null;

  try {
    const encodedPayload = cookieValue.slice(0, dotIdx);
    const sig = cookieValue.slice(dotIdx + 1);
    const payload = atob(encodedPayload);

    const expected = await hmacSign(payload, getSecret());
    if (expected !== sig) return null;

    const colonIdx = payload.lastIndexOf(':');
    if (colonIdx === -1) return null;

    const phone = payload.slice(0, colonIdx);
    const exp = parseInt(payload.slice(colonIdx + 1), 10);
    if (isNaN(exp) || Date.now() > exp) return null;

    return phone;
  } catch {
    return null;
  }
}
