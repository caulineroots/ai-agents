import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { createSession } from '@/lib/dashboard/session';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?erro=token_invalido', request.url));
  }

  // Busca token válido, não utilizado e não expirado
  const { data, error } = await supabase
    .from('dashboard_tokens')
    .select('phone, used, expires_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return NextResponse.redirect(new URL('/login?erro=token_invalido', request.url));
  }

  if (data.used) {
    return NextResponse.redirect(new URL('/login?erro=token_usado', request.url));
  }

  if (new Date(data.expires_at as string) < new Date()) {
    return NextResponse.redirect(new URL('/login?erro=token_expirado', request.url));
  }

  // Invalida o token (uso único)
  await supabase.from('dashboard_tokens').update({ used: true }).eq('token', token);

  // Cria sessão assinada com o phone
  const sessionValue = createSession(data.phone as string);

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set('dash_session', sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 dias
    path: '/',
  });

  return response;
}
