import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { clearSessionCookie, revokeSession, SESSION_COOKIE } from '@/lib/auth/session';

export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request);

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);

  const response = ok({ signed_out: true });
  clearSessionCookie(response);
  return response;
});
