/**
 * Helpers de sessão do dashboard — assina e valida cookies com HMAC-SHA256.
 * Formato do cookie: base64(phone:exp).HMAC
 * Compatível com o cookie legado (password string) para o owner.
 */

import { createHmac } from 'crypto';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function getSecret(): string {
  return process.env.DASHBOARD_SECRET ?? 'cauline-default-secret-change-me';
}

export function createSession(phone: string): string {
  const exp = Date.now() + SESSION_DURATION_MS;
  const payload = `${phone}:${exp}`;
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64')}.${sig}`;
}

/**
 * Valida o cookie e retorna o phone, ou null se inválido/expirado.
 * Aceita também o cookie legado (password) retornando OWNER_PHONE.
 */
export function getSessionPhone(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;

  // Backward compat: cookie legado é apenas a senha
  const password = process.env.DASHBOARD_PASSWORD ?? 'cauline2026';
  if (cookieValue === password) {
    return process.env.OWNER_PHONE ?? 'owner';
  }

  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx === -1) return null;

  try {
    const encodedPayload = cookieValue.slice(0, dotIdx);
    const sig = cookieValue.slice(dotIdx + 1);
    const payload = Buffer.from(encodedPayload, 'base64').toString('utf-8');

    const expectedSig = createHmac('sha256', getSecret()).update(payload).digest('hex');
    if (expectedSig !== sig) return null;

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
