import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'dash_session';

export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE);
  const password = process.env.DASHBOARD_PASSWORD ?? 'cauline2026';

  if (!session || session.value !== password) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
