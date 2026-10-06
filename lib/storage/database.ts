import path from 'node:path';
import type { z } from 'zod';
import { collectionSchemas, type CollectionName } from './schema';
import {
  StorageConfigurationError,
  StorageWriteError,
  createLocalDriver,
  registerDriver,
  resolveDriver,
  type StorageDriver,
} from './drivers';
import { DEFAULT_PACKAGES, DEFAULT_PAYMENT_SETTINGS, DEFAULT_SYSTEM_SETTINGS } from './defaults';

/**
 * JSON collection store.
 * ---------------------------------------------------------------------------
 * Every persisted collection in the platform is read and written through this
 * module. It provides:
 *
 *   1. automatic initialisation of data/ + storage/ and their seed files
 *   2. schema validation before writes and after reads
 *   3. atomic writes (temp file + fsync + rename, see drivers.ts)
 *   4. per-collection serialisation so concurrent writers cannot interleave
 *   5. corruption recovery — a bad file is quarantined, never fatal
 */

export const DATA_ROOT = path.resolve(process.cwd(), process.env.DATA_DIR || 'data');
export const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_DIR || 'storage');
export const RECEIPTS_ROOT = path.join(STORAGE_ROOT, 'receipts');

registerDriver(createLocalDriver({ root: DATA_ROOT }));

let cachedDriver: StorageDriver | null = null;

export function getDriver(): StorageDriver {
  if (!cachedDriver) {
    cachedDriver = resolveDriver(process.env.STORAGE_MODE);
  }
  return cachedDriver;
}

/** Test/back-office helper: reports which backend is actually in use. */
export function describeStorage() {
  const driver = getDriver();
  return {
    mode: driver.mode,
    label: driver.label,
    persistent: driver.persistent,
    data_root: DATA_ROOT,
    receipts_root: RECEIPTS_ROOT,
    is_production: process.env.NODE_ENV === 'production',
    warning:
      driver.persistent || process.env.NODE_ENV !== 'production'
        ? null
        : 'Local JSON storage is not durable on serverless platforms. Register a persistent storage driver before handling real funds.',
  };
}

interface CollectionDefinition {
  name: CollectionName;
  /** Path inside the data directory, e.g. `users/users.json`. */
  file: string;
  seed: () => unknown;
}

const DEFINITIONS: Record<CollectionName, CollectionDefinition> = {
  users: { name: 'users', file: path.join('users', 'users.json'), seed: () => [] },
  sessions: { name: 'sessions', file: path.join('sessions', 'sessions.json'), seed: () => [] },
  wallets: { name: 'wallets', file: path.join('wallets', 'wallets.json'), seed: () => [] },
  transactions: {
    name: 'transactions',
    file: path.join('transactions', 'transactions.json'),
    seed: () => [],
  },
  payments: { name: 'payments', file: path.join('payments', 'payments.json'), seed: () => [] },
  purchases: { name: 'purchases', file: path.join('purchases', 'purchases.json'), seed: () => [] },
  predictions: {
    name: 'predictions',
    file: path.join('predictions', 'predictions.json'),
    seed: () => [],
  },
  notifications: {
    name: 'notifications',
    file: path.join('notifications', 'notifications.json'),
    seed: () => [],
  },
  settings: {
    name: 'settings',
    file: path.join('settings', 'settings.json'),
    seed: () => ({ payments: DEFAULT_PAYMENT_SETTINGS, system: DEFAULT_SYSTEM_SETTINGS }),
  },
  packages: {
    name: 'packages',
    file: path.join('packages', 'packages.json'),
    seed: () => DEFAULT_PACKAGES,
  },
  audit: { name: 'audit', file: path.join('audit', 'activity.json'), seed: () => [] },
};

export const DATA_DIRECTORIES = [
  'users',
  'sessions',
  'wallets',
  'transactions',
  'payments',
  'purchases',
  'predictions',
  'notifications',
  'settings',
  'packages',
  'audit',
] as const;

/** Serialises read-modify-write cycles per collection (see `mutate`). */
const locks = new Map<CollectionName, Promise<unknown>>();

function serialise<T>(name: CollectionName, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(name) ?? Promise.resolve();
  const next = previous.then(task, task);
  locks.set(
    name,
    next.catch(() => undefined),
  );
  return next;
}

let initPromise: Promise<void> | null = null;

/** Creates data/, storage/receipts/ and every seed file that does not exist. */
export function ensureStore(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const driver = getDriver();
      await driver.ensureReady();
      await driver.ensureDir(path.join('storage', 'receipts')).catch(() => undefined);
      // Receipts live outside the data root, so make sure the folder exists.
      const { mkdir } = await import('node:fs/promises');
      await mkdir(RECEIPTS_ROOT, { recursive: true });

      for (const definition of Object.values(DEFINITIONS)) {
        await driver.ensureDir(path.dirname(definition.file));
        const existing = await driver.read(definition.file);
        if (existing === null) {
          await driver.write(definition.file, `${JSON.stringify(definition.seed(), null, 2)}\n`);
        }
      }
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function quarantine(name: CollectionName, raw: string, reason: string): Promise<void> {
  const driver = getDriver();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join('_corrupt', `${name}-${stamp}.json`);
  try {
    await driver.ensureDir('_corrupt');
    await driver.write(target, raw);
    console.error(
      `[storage] quarantined corrupt collection "${name}" (${reason}) -> data/${target.replace(/\\/g, '/')}`,
    );
  } catch {
    console.error(`[storage] corrupt collection "${name}" could not be quarantined (${reason})`);
  }
}

function parseCollection<T>(name: CollectionName, raw: string): T {
  const schema = collectionSchemas[name] as z.ZodTypeAny;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('invalid JSON');
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'schema validation failed');
  }
  return result.data as T;
}

/** Reads a collection, initialising storage when required. Never throws on ENOENT. */
export async function readCollection<T>(name: CollectionName): Promise<T> {
  await ensureStore();
  const definition = DEFINITIONS[name];
  const raw = await getDriver().read(definition.file);
  if (raw === null || raw.trim() === '') {
    const seed = definition.seed() as T;
    await getDriver().write(definition.file, `${JSON.stringify(seed, null, 2)}\n`);
    return seed;
  }
  try {
    return parseCollection<T>(name, raw);
  } catch (error) {
    await quarantine(name, raw, (error as Error).message);
    const seed = definition.seed() as T;
    await getDriver().write(definition.file, `${JSON.stringify(seed, null, 2)}\n`);
    return seed;
  }
}

/** Validates then atomically persists a collection. */
export async function writeCollection<T>(name: CollectionName, value: T): Promise<T> {
  await ensureStore();
  const schema = collectionSchemas[name] as z.ZodTypeAny;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new StorageWriteError(
      `Refusing to write invalid data to "${name}": ${result.error.issues[0]?.message ?? 'validation failed'}`,
    );
  }
  await getDriver().write(DEFINITIONS[name].file, `${JSON.stringify(result.data, null, 2)}\n`);
  return result.data as T;
}

/**
 * Read-modify-write under a per-collection lock.
 *
 * The mutator receives the current (validated) value and returns the next one.
 * Two concurrent mutations can therefore never lose each other's changes.
 */
export async function mutateCollection<T>(
  name: CollectionName,
  mutator: (current: T) => T | Promise<T>,
): Promise<T> {
  return serialise(name, async () => {
    const current = await readCollection<T>(name);
    const next = await mutator(current);
    return writeCollection<T>(name, next);
  });
}

export { StorageConfigurationError, StorageWriteError };
export type { CollectionName };
