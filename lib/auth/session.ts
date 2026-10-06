import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { sessionsCollection } from '@/lib/storage/collections';
import { getUserById, toPublicUser } from '@/lib/users/user-service';
import { Errors } from '@/lib/http';
import { newId, nowIso } from '@/lib/utils';
import { SESSION_COOKIE } from './constants';
import type { PublicUser, Session, User } from '@/types';

export { SESSION_COOKIE };

/**
 * Session management.
 * ---------------------------------------------------------------------------
 * • opaque 32 byte token in an HTTP-only, SameSite=Lax cookie
 * • only SHA-256(secret + token) is persisted, so a stolen data file cannot be
 *   replayed as a valid session
 * • sessions expire (SESSION_TTL_HOURS) and are revoked on logout
 * • every privileged page and API route re-checks the session server-side
 */

const DEFAULT_TTL_HOURS = 168; // 7 days
let warnedAboutSecret = false;

function sessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS);
  const safeHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 30) : DEFAULT_TTL_HOURS;
  return safeHours * 60 * 60 * 1000;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn('[auth] AUTH_SECRET is not set — using an insecure development secret.');
  }
  return 'dev-only-insecure-secret-please-set-AUTH_SECRET';
}

function hashToken(token: string): string {
  return createHash('sha256').update(`${getAuthSecret()}:${token}`).digest('hex');
}

export function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  };
}

export async function issueSession(
  user: User,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: Date; session: Session }> {
  const token = randomBytes(32).toString('hex');
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  const session: Session = {
    id: newId('ses'),
    user_id: user.id,
    token_hash: hashToken(token),
    created_at: timestamp,
    expires_at: expiresAt.toISOString(),
    last_seen_at: timestamp,
    revoked_at: null,
    ip_address: meta.ip ?? null,
    user_agent: meta.userAgent ?? null,
  };

  await sessionsCollection.mutate((sessions) => {
    const now = Date.now();
    const alive = sessions.filter(
      (entry) =>
        new Date(entry.expires_at).getTime() > now - 7 * 24 * 60 * 60 * 1000 &&
        (!entry.revoked_at || new Date(entry.revoked_at).getTime() > now - 7 * 24 * 60 * 60 * 1000),
    );
    return [...alive, session];
  });

  return { token, expiresAt, session };
}

export function applySessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export interface AuthenticatedContext {
  user: User;
  publicUser: PublicUser;
  session: Session;
}

async function readCookieToken(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** Resolves the signed-in user, or null. Expired/revoked sessions are rejected. */
export async function getCurrentUser(): Promise<AuthenticatedContext | null> {
  const token = await readCookieToken();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const sessions = await sessionsCollection.read();
  const session = sessions.find((entry) => {
    if (entry.revoked_at) return false;
    if (entry.token_hash.length !== tokenHash.length) return false;
    try {
      return timingSafeEqual(Buffer.from(entry.token_hash), Buffer.from(tokenHash));
    } catch {
      return false;
    }
  });

  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const user = await getUserById(session.user_id);
  if (!user) return null;

  return { user, publicUser: toPublicUser(user), session };
}

/** Throws 401 when there is no valid session. */
export async function requireUser(): Promise<AuthenticatedContext> {
  const context = await getCurrentUser();
  if (!context) throw Errors.unauthorized('Your session has expired. Please sign in again.');
  return context;
}

/**
 * Throws 403 unless the session belongs to an administrator.
 * Every admin API route calls this independently — hiding buttons in the UI is
 * cosmetic only.
 */
export async function requireAdmin(): Promise<AuthenticatedContext> {
  const context = await requireUser();
  if (context.user.role !== 'admin') {
    throw Errors.forbidden('Administrator access is required for this action.');
  }
  if (context.user.account_status !== 'active') {
    throw Errors.forbidden('This administrator account is not active.');
  }
  return context;
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const timestamp = nowIso();
  await sessionsCollection.mutate((sessions) =>
    sessions.map((session) =>
      session.token_hash === tokenHash && !session.revoked_at
        ? { ...session, revoked_at: timestamp }
        : session,
    ),
  );
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const timestamp = nowIso();
  await sessionsCollection.mutate((sessions) =>
    sessions.map((session) =>
      session.user_id === userId && !session.revoked_at
        ? { ...session, revoked_at: timestamp }
        : session,
    ),
  );
}

export async function listActiveSessions(userId: string): Promise<Session[]> {
  const sessions = await sessionsCollection.read();
  const now = Date.now();
  return sessions.filter(
    (session) =>
      session.user_id === userId &&
      !session.revoked_at &&
      new Date(session.expires_at).getTime() > now,
  );
}
