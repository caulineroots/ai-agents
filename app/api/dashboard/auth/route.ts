import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'dash_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expected = process.env.DASHBOARD_PASSWORD ?? 'cauline2026';

  if (!password || password !== expected) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
