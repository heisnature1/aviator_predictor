import { NextResponse, type NextRequest } from 'next/server';
import { Errors, ok, parseBody, readJsonBody, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { register } from '@/lib/auth/service';
import { applySessionCookie } from '@/lib/auth/session';
import { getSystemSettings } from '@/lib/settings/settings-service';
import { registrationSchema } from '@/lib/users/user-service';
import { clientIp, userAgent } from '@/lib/http';
import { LIMITS } from '@/lib/auth/rate-limit';

export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.register);

  const settings = await getSystemSettings();
  if (!settings.registration_open) {
    throw Errors.forbidden('New registrations are currently closed. Please try again later.');
  }

  const payload = parseBody(registrationSchema, await readJsonBody(request));
  const { user, token, expiresAt, requiresActivation } = await register(payload, {
    ip: clientIp(request),
    userAgent: userAgent(request),
  });

  const response = ok(
    { user, requires_activation: requiresActivation, account_status: user.account_status },
    201,
  );
  if (token && expiresAt) applySessionCookie(response, token, expiresAt);
  return response;
});
