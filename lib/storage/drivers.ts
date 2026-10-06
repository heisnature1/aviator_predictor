import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Storage driver abstraction.
 * ---------------------------------------------------------------------------
 * The platform never talks to `fs` directly — every read/write goes through a
 * `StorageDriver`. `local` (JSON files in ./data) ships with the product and is
 * correct for development and single-node self hosting.
 *
 * `local` (JSON files) is intended for development or one server with a
 * persistent disk. `postgres` stores documents in Supabase Postgres and
 * receipts in its private Storage bucket for Vercel/serverless deployments.
 * Additional drivers can be registered with `registerDriver()` without
 * changing business logic.
 *
 * IMPORTANT: a serverless platform does NOT give you a permanent writable disk.
 * If `STORAGE_MODE` is set to anything that has no registered driver, the app
 * refuses to boot rather than silently losing accounts, payments and wallets.
 */

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

export class StorageWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageWriteError';
  }
}

export interface StorageDriver {
  /** Value of STORAGE_MODE that selects this driver. */
  readonly mode: string;
  /** Human readable name used in logs / admin diagnostics. */
  readonly label: string;
  /** True when writes survive a redeploy (i.e. safe for serverless). */
  readonly persistent: boolean;
  ensureReady(): Promise<void>;
  read(relativePath: string): Promise<string | null>;
  write(relativePath: string, contents: string): Promise<void>;
  remove(relativePath: string): Promise<void>;
  list(relativeDir: string): Promise<string[]>;
  /** Optional atomic read/modify/write used by remote document stores. */
  update?(
    relativePath: string,
    updater: (current: string | null) => Promise<string> | string,
  ): Promise<string>;
  /** Optional multi-document transaction, with an optional distributed lock key. */
  transaction?<T>(task: () => Promise<T>, lockKey?: string): Promise<T>;
  /** Optional: create a directory (used for receipt storage). */
  ensureDir(relativeDir: string): Promise<void>;
}

/** Minimal in-process retry helper for transient filesystem contention. */
async function withRetry<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'EBUSY' && code !== 'EMFILE' && code !== 'EAGAIN') throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)));
    }
  }
  throw lastError;
}

export interface LocalDriverOptions {
  /** Absolute base directory for the driver (the `data` directory). */
  root: string;
}

/**
 * Atomic, crash-safe local JSON driver.
 *
 * Write protocol:
 *   1. write payload to a unique temp file in the same directory
 *   2. fsync the temp file so the bytes are on disk
 *   3. atomically rename the temp file over the target
 *
 * A crash between any two steps can never leave a half-written JSON file —
 * readers always see either the previous or the new complete document.
 */
export function createLocalDriver(options: LocalDriverOptions): StorageDriver {
  const root = path.resolve(options.root);

  const resolveSafe = (relativePath: string) => {
    const target = path.resolve(root, relativePath);
    const normalisedRoot = root.endsWith(path.sep) ? root : root + path.sep;
    if (target !== root && !target.startsWith(normalisedRoot)) {
      throw new StorageWriteError('Refusing to access a path outside the data directory');
    }
    return target;
  };

  return {
    mode: 'local',
    label: 'Local JSON file storage',
    persistent: false,

    async ensureDir(relativeDir) {
      await fs.mkdir(resolveSafe(relativeDir), { recursive: true });
    },

    async ensureReady() {
      await fs.mkdir(root, { recursive: true });
    },

    async read(relativePath) {
      try {
        return await fs.readFile(resolveSafe(relativePath), 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },

    async write(relativePath, contents) {
      const target = resolveSafe(relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const tmp = path.join(
        path.dirname(target),
        `.${path.basename(target)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
      );
      await withRetry(async () => {
        const handle = await fs.open(tmp, 'w');
        try {
          await handle.writeFile(contents, 'utf8');
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fs.rename(tmp, target);
      });
    },

    async remove(relativePath) {
      try {
        await fs.unlink(resolveSafe(relativePath));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },

    async list(relativeDir) {
      try {
        return await fs.readdir(resolveSafe(relativeDir));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
    },
  };
}

const drivers = new Map<string, StorageDriver>();

export function registerDriver(driver: StorageDriver): void {
  drivers.set(driver.mode, driver);
}

export function listDrivers(): StorageDriver[] {
  return Array.from(drivers.values());
}

/**
 * Resolve the driver for the configured STORAGE_MODE.
 * Fails loudly for unknown modes so data is never silently discarded.
 */
export function resolveDriver(mode: string | undefined): StorageDriver {
  const resolvedMode = (mode ?? 'local').trim() || 'local';
  const driver = drivers.get(resolvedMode);
  if (!driver) {
    throw new StorageConfigurationError(
      `STORAGE_MODE="${resolvedMode}" has no registered storage driver. ` +
        `Set STORAGE_MODE=local for the built-in JSON backend, or set ` +
        `STORAGE_MODE=postgres and a Supabase Postgres connection URL. ` +
        `The application refuses to start rather than silently lose accounts, ` +
        `payments and wallet balances.`,
    );
  }
  return driver;
}
