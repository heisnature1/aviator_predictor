import { NextResponse } from 'next/server';
import { route } from '@/lib/http';
import { createCsrfToken, csrfCookieOptions, CSRF_COOKIE } from '@/lib/auth/csrf';

/**
 * Issues a fresh CSRF cookie. The browser reads the cookie value and echoes it
 * in the `x-csrf-token` header on every mutation.
 *
 * Wrapped in `route()` so a misconfigured AUTH_SECRET surfaces as a clean,
 * user-visible 503 instead of an unhandled crash.
 */
export const GET = route(async () => {
  const token = createCsrfToken();
  const response = NextResponse.json({ ok: true, data: { issued: true } });
  response.cookies.set(CSRF_COOKIE, token, csrfCookieOptions());
  return response;
});
