import { NextResponse } from 'next/server';
import { createCsrfToken, csrfCookieOptions, CSRF_COOKIE } from '@/lib/auth/csrf';

/**
 * Issues a fresh CSRF cookie. The browser reads the cookie value and echoes it
 * in the `x-csrf-token` header on every mutation.
 */
export async function GET() {
  const token = createCsrfToken();
  const response = NextResponse.json({ ok: true, data: { issued: true } });
  response.cookies.set(CSRF_COOKIE, token, csrfCookieOptions());
  return response;
}
