import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { createSession } from '@/lib/dashboard/session';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.caulineroots.com';

export async function GET(request: NextRequest) {
  console.log('[magic-login] inicio. BASE_URL:', BASE);
  console.log('[magic-login] NODE_ENV:', process.env.NODE_ENV);

  const token = request.nextUrl.searchParams.get('token');
  console.log('[magic-login] token recebido:', token ? `${token.slice(0, 8)}...` : 'NENHUM');

  if (!token) {
    console.log('[magic-login] erro: sem token');
    return NextResponse.redirect(new URL('/login?erro=token_invalido', BASE));
  }

  const { data, error } = await supabase
    .from('dashboard_tokens')
    .select('phone, used, expires_at')
    .eq('token', token)
    .single();

  console.log('[magic-login] supabase data:', JSON.stringify(data));
  console.log('[magic-login] supabase error:', error?.message ?? 'nenhum');

  if (error || !data) {
    console.log('[magic-login] erro: token invalido ou nao encontrado');
    return NextResponse.redirect(new URL('/login?erro=token_invalido', BASE));
  }

  if (data.used) {
    console.log('[magic-login] erro: token ja usado');
    return NextResponse.redirect(new URL('/login?erro=token_usado', BASE));
  }

  if (new Date(data.expires_at as string) < new Date()) {
    console.log('[magic-login] erro: token expirado');
    return NextResponse.redirect(new URL('/login?erro=token_expirado', BASE));
  }

  console.log('[magic-login] token valido para phone:', data.phone);

  await supabase.from('dashboard_tokens').update({ used: true }).eq('token', token);
  console.log('[magic-login] token marcado como usado');

  const sessionValue = await createSession(data.phone as string);
  console.log('[magic-login] session criada, primeiros 20 chars:', sessionValue.slice(0, 20));

  const response = NextResponse.redirect(new URL('/dashboard', BASE));
  response.cookies.set('dash_session', sessionValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  console.log('[magic-login] Set-Cookie configurado. Redirecionando para /dashboard');
  return response;
}
