import { ensureStore } from '@/lib/storage/database';
import { ensureDefaultPackages } from '@/lib/packages/package-service';
import { createAdminAccount, getUserByEmail } from '@/lib/users/user-service';

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

export function bootstrapPlatform(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = (async () => {
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
