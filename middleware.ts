import { NextRequest, NextResponse } from 'next/server';
import { getSessionPhone } from '@/lib/dashboard/session';

const SESSION_COOKIE = 'dash_session';

export function middleware(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const phone = getSessionPhone(cookieValue);

  if (!phone) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Passa o phone como header interno para as rotas de API e páginas
  const response = NextResponse.next();
  response.headers.set('x-session-phone', phone);
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
