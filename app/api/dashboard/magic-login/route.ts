import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { createSession } from '@/lib/dashboard/session';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.caulineroots.com';

function redirectWithError(erro: string) {
  return NextResponse.redirect(new URL(`/login?erro=${erro}`, BASE));
}

export async function GET(request: NextRequest) {
  console.log('[magic-login] inicio. BASE_URL:', BASE);

  const token = request.nextUrl.searchParams.get('token');
  console.log('[magic-login] token recebido:', token ? `${token.slice(0, 8)}...` : 'NENHUM');

  if (!token) return redirectWithError('token_invalido');

  const { data, error } = await supabase
    .from('dashboard_tokens')
    .select('phone, used, expires_at')
    .eq('token', token)
    .single();

  console.log('[magic-login] supabase data:', JSON.stringify(data));
  console.log('[magic-login] supabase error:', error?.message ?? 'nenhum');

  if (error || !data) return redirectWithError('token_invalido');
  if (data.used) return redirectWithError('token_usado');
  if (new Date(data.expires_at as string) < new Date()) return redirectWithError('token_expirado');

  console.log('[magic-login] token valido para phone:', data.phone);
  await supabase.from('dashboard_tokens').update({ used: true }).eq('token', token);

  const sessionValue = await createSession(data.phone as string);
  console.log('[magic-login] session criada, length:', sessionValue.length);

  // Railway stripa Set-Cookie em respostas 302.
  // Retornamos 200 com Set-Cookie header (proxy nao strip em 200).
  // O JS na pagina faz o redirect depois que o browser ja armazenou o cookie.
  const dashboardUrl = `${BASE}/dashboard`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Autenticando...</title></head>
<body>
<p>Autenticando, aguarde...</p>
<script>window.location.replace(${JSON.stringify(dashboardUrl)});</script>
</body>
</html>`;

  console.log('[magic-login] retornando 200 com Set-Cookie + JS redirect para:', dashboardUrl);

  const response = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

  response.cookies.set('dash_session', sessionValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
