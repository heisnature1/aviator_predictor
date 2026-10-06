import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing.
 * ---------------------------------------------------------------------------
 * scrypt (memory hard) with a per-password random salt, stored in the
 * `scrypt$<cost>$<salt>$<hash>` format so parameters can be upgraded later.
 *
 * Plaintext passwords are never written to disk or logged.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const PASSWORD_MIN_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || typeof password !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    if (salt.length === 0 || expected.length === 0) return false;
    const derived = await scrypt(password, salt, expected.length, {
      N: Number(n) || PARAMS.N,
      r: Number(r) || PARAMS.r,
      p: Number(p) || PARAMS.p,
      maxmem: PARAMS.maxmem,
    });
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface PasswordAssessment {
  valid: boolean;
  score: number;
  errors: string[];
}

/** Server-side password strength check (client hints are never trusted). */
export function assessPassword(password: string): PasswordAssessment {
  const errors: string[] = [];
  const value = password ?? '';

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(value)) errors.push('Add a lowercase letter.');
  if (!/[A-Z]/.test(value)) errors.push('Add an uppercase letter.');
  if (!/[0-9]/.test(value)) errors.push('Add a number.');

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  return { valid: errors.length === 0, score: Math.min(score, 5), errors };
}
