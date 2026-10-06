import { NextResponse, type NextRequest } from 'next/server';
import { ok, parseBody, readJsonBody, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { signIn, loginSchema } from '@/lib/auth/service';
import { applySessionCookie } from '@/lib/auth/session';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp, userAgent } from '@/lib/http';

export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.login);

  const payload = parseBody(loginSchema, await readJsonBody(request));
  const { user, token, expiresAt } = await signIn(payload, {
    ip: clientIp(request),
    userAgent: userAgent(request),
  });

  const response = ok({ user });
  applySessionCookie(response, token, expiresAt);
  return response;
});
