import { NextRequest, NextResponse } from 'next/server';
import { getSessionPhone } from '@/lib/dashboard/session';

const SESSION_COOKIE = 'dash_session';

export async function middleware(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;

  console.log('[middleware] path:', request.nextUrl.pathname);
  console.log('[middleware] cookie dash_session existe:', !!cookieValue);
  console.log('[middleware] cookie valor (primeiros 20):', cookieValue ? cookieValue.slice(0, 20) : 'NENHUM');

  const phone = await getSessionPhone(cookieValue);

  console.log('[middleware] phone extraido:', phone ?? 'NULL - vai redirecionar p login');

  if (!phone) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.caulineroots.com';
    const loginUrl = new URL('/login', base);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    console.log('[middleware] redirecionando para:', loginUrl.toString());
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set('x-session-phone', phone);
  console.log('[middleware] acesso permitido para phone:', phone);
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
