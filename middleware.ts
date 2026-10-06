import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * First-line route guard (Edge runtime — no Node APIs, no filesystem).
 *
 * This only checks whether a session cookie exists, which is enough to avoid
 * rendering a signed-in page for an anonymous visitor. It is NOT the
 * authorization check: cookie signature, expiry, revocation and the admin role
 * are verified on the server in `lib/auth/session.ts` (called by every server
 * page layout and every `/api/*` route). A forged cookie gets past this file
 * and is rejected immediately afterwards.
 */

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/predictions',
  '/wallet',
  '/payments',
  '/notifications',
  '/admin',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get('av_session')?.value);

  if (hasSessionCookie) return NextResponse.next();

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/predictions/:path*',
    '/wallet/:path*',
    '/payments/:path*',
    '/notifications/:path*',
    '/admin/:path*',
  ],
};
