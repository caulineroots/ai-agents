import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { createSession } from '@/lib/dashboard/session';

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.caulineroots.com';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?erro=token_invalido', BASE));
  }

  const { data, error } = await supabase
    .from('dashboard_tokens')
    .select('phone, used, expires_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return NextResponse.redirect(new URL('/login?erro=token_invalido', BASE));
  }

  if (data.used) {
    return NextResponse.redirect(new URL('/login?erro=token_usado', BASE));
  }

  if (new Date(data.expires_at as string) < new Date()) {
    return NextResponse.redirect(new URL('/login?erro=token_expirado', BASE));
  }

  await supabase.from('dashboard_tokens').update({ used: true }).eq('token', token);

  const sessionValue = await createSession(data.phone as string);

  const response = NextResponse.redirect(new URL('/dashboard', BASE));
  response.cookies.set('dash_session', sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
