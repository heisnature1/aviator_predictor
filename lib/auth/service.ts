import { z } from 'zod';
import { verifyPassword } from './password';
import { issueSession } from './session';
import { guardRate, LIMITS, reset } from './rate-limit';
import { Errors } from '@/lib/http';
import {
  createUser,
  findUserByLogin,
  recordFailedLogin,
  recordSuccessfulLogin,
  toPublicUser,
  type RegistrationInput,
} from '@/lib/users/user-service';
import { notify } from '@/lib/notifications/notification-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { nowIso } from '@/lib/utils';
import type { PublicUser, User } from '@/types';

/**
 * Authentication workflows: registration and sign-in.
 *
 * Protection applied on every attempt:
 *   • IP + identifier rate limits
 *   • per-account lockout after repeated failures
 *   • constant, non-enumerating error messages
 *   • scrypt password verification (constant time compare)
 */

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or username.').max(160),
  password: z.string().min(1, 'Enter your password.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

const GENERIC_LOGIN_ERROR = 'The email/username or password you entered is incorrect.';

export interface AuthResult {
  user: PublicUser;
  token: string;
  expiresAt: Date;
}

export async function signIn(
  input: LoginInput,
  context: { ip?: string | null; userAgent?: string | null } = {},
): Promise<AuthResult> {
  const parsed = loginSchema.parse(input);
  const ipKey = context.ip ?? 'unknown';
  const identifierKey = parsed.identifier.toLowerCase();

  guardRate(`login:${ipKey}`, LIMITS.login);
  guardRate(`login:id:${identifierKey}`, LIMITS.login);

  const user = await findUserByLogin(parsed.identifier);
  if (!user) {
    // Burn comparable time so response timing does not leak account existence.
    await verifyPassword(parsed.password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
    throw Errors.invalid(GENERIC_LOGIN_ERROR);
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutes = Math.ceil(
      (new Date(user.locked_until).getTime() - Date.now()) / 60_000,
    );
    throw Errors.tooMany(
      `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  }

  const valid = await verifyPassword(parsed.password, user.password_hash);
  if (!valid) {
    await recordFailedLogin(user.id);
    throw Errors.invalid(GENERIC_LOGIN_ERROR);
  }

  if (user.account_status === 'suspended') {
    throw Errors.forbidden(
      'This account has been suspended. Contact support for assistance.',
    );
  }

  await recordSuccessfulLogin(user.id);
  reset(`login:id:${identifierKey}`);

  const { token, expiresAt } = await issueSession(user, context);

  await notify({
    user_id: user.id,
    kind: 'system',
    title: 'New sign-in',
    message: `Your account was signed in${
      context.userAgent ? ` from ${context.userAgent.slice(0, 60)}` : ''
    }. If this was not you, change your password immediately.`,
  }).catch(() => undefined);

  await recordAudit({
    admin_id: null,
    action: user.role === 'admin' ? 'admin_login' : 'user_login',
    target_user: user.id,
    target_label: `${user.full_name} (${user.email})`,
    previous_value: user.last_login,
    new_value: nowIso(),
    ip_address: context.ip ?? null,
  });

  return { user: toPublicUser(user), token, expiresAt };
}

export async function register(
  input: RegistrationInput,
  context: { ip?: string | null; userAgent?: string | null; autoSignIn?: boolean } = {},
): Promise<{ user: PublicUser; token: string | null; expiresAt: Date | null; requiresActivation: true }> {
  guardRate(`register:${context.ip ?? 'unknown'}`, LIMITS.register);

  const user: User = await createUser(input);

  await notify({
    user_id: user.id,
    kind: 'account_registered',
    title: 'Welcome to Aviator Insights',
    message:
      'Your account was created. Complete the activation payment and upload your receipt to unlock predictions.',
    link: '/payments',
  });

  await recordAudit({
    admin_id: null,
    action: 'user_registered',
    target_user: user.id,
    target_label: `${user.full_name} (${user.email})`,
    previous_value: null,
    new_value: 'account_status:pending',
    ip_address: context.ip ?? null,
  });

  let token: string | null = null;
  let expiresAt: Date | null = null;
  if (context.autoSignIn !== false) {
    const session = await issueSession(user, context);
    token = session.token;
    expiresAt = session.expiresAt;
    await recordSuccessfulLogin(user.id);
  }

  return { user: toPublicUser(user), token, expiresAt, requiresActivation: true };
}
