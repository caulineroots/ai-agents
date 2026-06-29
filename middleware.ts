import { NextRequest, NextResponse } from 'next/server';
import { getSessionPhone } from '@/lib/dashboard/session';

const SESSION_COOKIE = 'dash_session';

export async function middleware(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const phone = await getSessionPhone(cookieValue);

  if (!phone) {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ai.caulineroots.com';
    const loginUrl = new URL('/login', base);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set('x-session-phone', phone);
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
