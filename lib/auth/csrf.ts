import { createHmac, randomBytes } from 'node:crypto';
import { getAuthSecret } from './session';
import { Errors } from '@/lib/http';
import { CSRF_COOKIE, CSRF_HEADER } from './constants';

export { CSRF_COOKIE, CSRF_HEADER };

/**
 * CSRF protection (double submit cookie).
 *
 * The token is a signed random value stored in a readable cookie. Browser code
 * echoes it in the `x-csrf-token` header; a cross-site page can neither read
 * the cookie nor set the header, so forged requests are rejected.
 *
 * `assertCsrf` is applied to every state-changing API route.
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/** HMAC binding to the app secret so tokens cannot be minted by a client. */
function sign(value: string): string {
  return createHmac('sha256', getAuthSecret()).update(value).digest('base64url').slice(0, 22);
}

export function createCsrfToken(): string {
  const random = randomBytes(24).toString('base64url');
  return `${random}.${Date.now().toString(36)}.${sign(random)}`;
}

export function verifyCsrfToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [random, issuedAt, signature] = parts;
  if (!random || !issuedAt || !signature) return false;
  if (signature !== sign(random)) return false;
  const age = Date.now() - parseInt(issuedAt, 36);
  if (!Number.isFinite(age) || age > TOKEN_TTL_MS || age < 0) return false;
  return true;
}

export function csrfCookieOptions() {
  return {
    httpOnly: false, // must be readable by the browser to echo it back
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TOKEN_TTL_MS / 1000,
  };
}

/**
 * Validates the CSRF header against the cookie for mutating requests.
 */
export function assertCsrf(request: Request): void {
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf('=');
      return index === -1 ? ['', ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
    .find(([name]) => name === CSRF_COOKIE)?.[1];

  if (!verifyCsrfToken(cookieToken)) {
    throw Errors.forbidden('Your session security token is missing or expired. Please refresh the page.');
  }
  if (!headerToken || headerToken !== cookieToken) {
    throw Errors.forbidden('Security token mismatch. Please refresh the page and try again.');
  }
}
