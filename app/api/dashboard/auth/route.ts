import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/dashboard/session';

/**
 * Credenciais carregadas das env vars.
 *
 * Formato de DASHBOARD_USERS:
 *   phone1:senha1,phone2:senha2
 *
 * O owner pode usar OWNER_PHONE + DASHBOARD_PASSWORD como alternativa.
 */
function getCredentials(): Map<string, string> {
  const map = new Map<string, string>();

  const defaultPass = process.env.DASHBOARD_PASSWORD ?? '1234';

  // Owner direto
  const ownerPhone = process.env.OWNER_PHONE;
  if (ownerPhone) map.set(ownerPhone, defaultPass);

  // Allowed phones com senha padrao
  const allowedRaw = process.env.ALLOWED_PHONES ?? '';
  for (const p of allowedRaw.split(',')) {
    const phone = p.trim();
    if (phone && !map.has(phone)) map.set(phone, defaultPass);
  }

  // Usuarios adicionais: DASHBOARD_USERS=phone:senha,phone2:senha2
  const raw = process.env.DASHBOARD_USERS ?? '';
  for (const entry of raw.split(',')) {
    const [phone, ...rest] = entry.trim().split(':');
    const pass = rest.join(':').trim();
    if (phone && pass) map.set(phone.trim(), pass);
  }

  return map;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { phone, password } = body as { phone?: string; password?: string };

  if (!phone || !password) {
    return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 });
  }

  const credentials = getCredentials();
  const expectedPassword = credentials.get(phone.trim());

  if (!expectedPassword || expectedPassword !== password) {
    return NextResponse.json({ error: 'Número ou senha inválidos.' }, { status: 401 });
  }

  const sessionValue = await createSession(phone.trim());

  const response = NextResponse.json({ ok: true });
  response.cookies.set('dash_session', sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
