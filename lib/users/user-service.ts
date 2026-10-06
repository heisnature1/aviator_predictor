import { z } from 'zod';
import { usersCollection } from '@/lib/storage/collections';
import { assessPassword, hashPassword, PASSWORD_MIN_LENGTH } from '@/lib/auth/password';
import { newId, nowIso } from '@/lib/utils';
import { Errors } from '@/lib/http';
import type { AccountStatus, PublicUser, User, UserRole } from '@/types';

/**
 * User repository & validation.
 * All writes are validated server-side; nothing from the client is trusted.
 */

export const registrationSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, 'Enter your full name.')
      .max(80, 'That name is too long.')
      .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u, 'Use letters, spaces, apostrophes or hyphens only.'),
    username: z
      .string()
      .trim()
      .min(3, 'Username must be at least 3 characters.')
      .max(24, 'Username must be 24 characters or fewer.')
      .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers and underscores only.'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
    phone: z
      .string()
      .trim()
      .min(6, 'Enter a valid phone number.')
      .max(24, 'That phone number is too long.')
      .regex(/^\+?[0-9][0-9\s()-]*$/, 'Use digits, spaces, brackets and +/- only.'),
    password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match.',
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

export function toPublicUser(user: User): PublicUser {
  const { password_hash: _hash, failed_login_attempts: _f, locked_until: _l, ...safe } = user;
  return safe;
}

export const PUBLIC_USER_FIELDS = [
  'id',
  'full_name',
  'username',
  'email',
  'phone',
  'role',
  'account_status',
  'created_at',
  'updated_at',
  'last_login',
] as const;

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function listUsers(): Promise<User[]> {
  return usersCollection.read();
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await usersCollection.read();
  return users.find((user) => user.id === id) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const target = normaliseEmail(email);
  const users = await usersCollection.read();
  return users.find((user) => normaliseEmail(user.email) === target) ?? null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const target = normaliseUsername(username);
  const users = await usersCollection.read();
  return users.find((user) => normaliseUsername(user.username) === target) ?? null;
}

export async function findUserByLogin(identifier: string): Promise<User | null> {
  const users = await usersCollection.read();
  const target = identifier.trim().toLowerCase();
  return (
    users.find(
      (user) =>
        normaliseEmail(user.email) === target ||
        normaliseUsername(user.username) === target ||
        user.username === identifier.trim(),
    ) ?? null
  );
}

/**
 * Creates a `pending` account. The account is NEVER activated here —
 * activation only happens when an administrator approves the activation
 * payment (see lib/payments/payment-service.ts).
 */
export async function createUser(input: RegistrationInput): Promise<User> {
  const parsed = registrationSchema.parse(input);

  const assessment = assessPassword(parsed.password);
  if (!assessment.valid) {
    throw Errors.invalid(assessment.errors[0] ?? 'Please choose a stronger password.', {
      password: assessment.errors[0] ?? 'Please choose a stronger password.',
    });
  }

  const password_hash = await hashPassword(parsed.password);
  const timestamp = nowIso();
  let created: User | null = null;

  await usersCollection.mutate((users) => {
    if (users.some((user) => normaliseEmail(user.email) === normaliseEmail(parsed.email))) {
      throw Errors.conflict('An account with that email address already exists.');
    }
    if (
      users.some((user) => normaliseUsername(user.username) === normaliseUsername(parsed.username))
    ) {
      throw Errors.conflict('That username is already taken.');
    }

    const user: User = {
      id: newId('usr'),
      full_name: parsed.full_name,
      username: parsed.username,
      email: normaliseEmail(parsed.email),
      phone: parsed.phone,
      password_hash,
      role: 'user',
      account_status: 'pending',
      created_at: timestamp,
      updated_at: timestamp,
      last_login: null,
      activated_by_payment_id: null,
      status_note: null,
      failed_login_attempts: 0,
      locked_until: null,
    };
    created = user;

    return [...users, user];
  });

  if (!created) throw Errors.server('The account could not be created. Please try again.');
  return created;
}

/**
 * Creates an administrator account (used by `npm run seed` and the
 * ADMIN_* environment bootstrap). Never callable from the public API.
 */
export async function createAdminAccount(input: {
  email: string;
  password: string;
  full_name: string;
  username?: string;
  phone?: string;
}): Promise<User> {
  const assessment = assessPassword(input.password);
  if (!assessment.valid) {
    throw Errors.invalid(
      `The admin password is too weak: ${assessment.errors.join(' ')}`,
    );
  }

  const password_hash = await hashPassword(input.password);
  const timestamp = nowIso();
  let created: User | null = null;

  await usersCollection.mutate((users) => {
    if (users.some((user) => normaliseEmail(user.email) === normaliseEmail(input.email))) {
      return users; // idempotent — the admin already exists
    }
    let username = (input.username || input.email.split('@')[0] || 'admin')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 24);
    if (username.length < 3) username = 'admin';
    let candidate = username;
    let suffix = 1;
    while (users.some((user) => normaliseUsername(user.username) === candidate)) {
      suffix += 1;
      candidate = `${username}${suffix}`;
    }

    created = {
      id: newId('usr'),
      full_name: input.full_name,
      username: candidate,
      email: normaliseEmail(input.email),
      phone: input.phone ?? '—',
      password_hash,
      role: 'admin',
      account_status: 'active',
      created_at: timestamp,
      updated_at: timestamp,
      last_login: null,
      activated_by_payment_id: null,
      status_note: 'Seeded administrator',
      failed_login_attempts: 0,
      locked_until: null,
    };
    return [...users, created];
  });

  if (!created) {
    const existing = await getUserByEmail(input.email);
    if (existing) return existing;
    throw Errors.server('The administrator account could not be created.');
  }
  return created;
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<User, 'id' | 'password_hash'>>,
): Promise<User> {
  const timestamp = nowIso();
  let updated: User | null = null;
  await usersCollection.mutate((users) =>
    users.map((user) => {
      if (user.id !== id) return user;
      updated = { ...user, ...patch, id: user.id, updated_at: timestamp };
      return updated;
    }),
  );
  if (!updated) throw Errors.notFound('User not found.');
  return updated as User;
}

export async function setAccountStatus(
  id: string,
  status: AccountStatus,
  note?: string | null,
): Promise<User> {
  return updateUser(id, { account_status: status, status_note: note ?? null });
}

export async function setUserRole(id: string, role: UserRole): Promise<User> {
  return updateUser(id, { role });
}

export async function setPassword(id: string, password: string): Promise<void> {
  const assessment = assessPassword(password);
  if (!assessment.valid) {
    throw Errors.invalid(assessment.errors[0] ?? 'Please choose a stronger password.');
  }
  const hash = await hashPassword(password);
  await usersCollection.mutate((users) =>
    users.map((user) =>
      user.id === id ? { ...user, password_hash: hash, updated_at: nowIso() } : user,
    ),
  );
}

export async function recordSuccessfulLogin(id: string): Promise<void> {
  await usersCollection.mutate((users) =>
    users.map((user) =>
      user.id === id
        ? { ...user, last_login: nowIso(), failed_login_attempts: 0, locked_until: null }
        : user,
    ),
  );
}

export async function recordFailedLogin(id: string, maxAttempts = 8): Promise<void> {
  await usersCollection.mutate((users) =>
    users.map((user) => {
      if (user.id !== id) return user;
      const attempts = (user.failed_login_attempts ?? 0) + 1;
      const lockedUntil =
        attempts >= maxAttempts ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
      return { ...user, failed_login_attempts: attempts, locked_until: lockedUntil };
    }),
  );
}

export interface UserStats {
  total: number;
  active: number;
  pending: number;
  rejected: number;
  suspended: number;
  admins: number;
}

export async function userStats(): Promise<UserStats> {
  const users = await usersCollection.read();
  return {
    total: users.length,
    active: users.filter((user) => user.account_status === 'active').length,
    pending: users.filter((user) => user.account_status === 'pending').length,
    rejected: users.filter((user) => user.account_status === 'rejected').length,
    suspended: users.filter((user) => user.account_status === 'suspended').length,
    admins: users.filter((user) => user.role === 'admin').length,
  };
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  pending: 'Pending activation',
  active: 'Active',
  rejected: 'Rejected',
  suspended: 'Suspended',
};
