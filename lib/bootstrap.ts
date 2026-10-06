import { ensureStore } from '@/lib/storage/database';
import { ensureDefaultPackages } from '@/lib/packages/package-service';
import { createAdminAccount, getUserByEmail } from '@/lib/users/user-service';
import { describeAuthSecret } from '@/lib/auth/session';

/**
 * Platform bootstrap.
 *
 * Runs once per process (and on demand):
 *   • creates data/ and storage/ with their seed files
 *   • restores the default credit packages when the catalogue is empty
 *   • creates the administrator account described by the ADMIN_* env vars
 *
 * Idempotent and safe to call repeatedly.
 */

let bootstrapped: Promise<void> | null = null;

export async function ensureAdminFromEnv(): Promise<{ created: boolean; email: string | null }> {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return { created: false, email: null };

  const existing = await getUserByEmail(email);
  if (existing) return { created: false, email };

  await createAdminAccount({
    email,
    password,
    full_name: process.env.ADMIN_FULL_NAME?.trim() || 'Platform Administrator',
    username: process.env.ADMIN_USERNAME?.trim(),
  });
  console.info(`[bootstrap] administrator created for ${email}`);
  return { created: true, email };
}

/**
 * Loud, unmissable boot diagnostic for the most common production outage:
 * a missing/placeholder AUTH_SECRET. The app degrades safely (visitors are
 * treated as signed out, mutations return a clear 503), but the operator
 * should see exactly what is wrong in the server log immediately.
 */
function warnIfAuthSecretMisconfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const status = describeAuthSecret();
  if (status.configured) return;
  console.error(
    [
      '',
      '=====================================================================',
      '  AVIATOR INSIGHTS — CONFIGURATION ERROR',
      `  AUTH_SECRET is ${status.reason}. Until it is set, nobody can sign`,
      '  in and every account action is rejected with a 503.',
      '  Generate one with:',
      "    node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
      '  and expose it as the AUTH_SECRET environment variable.',
      '=====================================================================',
      '',
    ].join('\n'),
  );
}

export function bootstrapPlatform(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      warnIfAuthSecretMisconfigured();
      await ensureStore();
      await ensureDefaultPackages();
      try {
        await ensureAdminFromEnv();
      } catch (error) {
        console.error(
          '[bootstrap] could not create the administrator account:',
          (error as Error).message,
        );
      }
    })().catch((error) => {
      bootstrapped = null;
      console.error('[bootstrap] failed:', (error as Error).message);
      throw error;
    });
  }
  return bootstrapped;
}
