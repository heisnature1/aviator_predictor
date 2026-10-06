import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient } from 'pg';
import { getSupabaseClient } from './supabase-client';
import { StorageConfigurationError, StorageWriteError, type StorageDriver } from './drivers';

const TABLE_NAME = 'public.aviator_storage_documents';
const transactionClient = new AsyncLocalStorage<PoolClient>();
const ADVISORY_LOCK_SQL = 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))';

interface SupabaseGlobals {
  __aviatorSupabasePool?: Pool;
  __aviatorSupabaseDatabaseUrl?: string;
}

const supabaseGlobals = globalThis as typeof globalThis & SupabaseGlobals;
let tableReady: Promise<void> | null = null;

function connectionString(): string {
  const value =
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim();
  if (!value) {
    throw new StorageConfigurationError(
      'STORAGE_MODE="postgres" requires a Supabase transaction-pooler URL in SUPABASE_DB_URL, DATABASE_URL, or POSTGRES_URL. Set it in Vercel, then redeploy.',
    );
  }
  return value;
}

function getPool(): Pool {
  const url = connectionString();
  if (!supabaseGlobals.__aviatorSupabasePool || supabaseGlobals.__aviatorSupabaseDatabaseUrl !== url) {
    supabaseGlobals.__aviatorSupabasePool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: true },
      max: 1,
      idleTimeoutMillis: 10_000,
      maxLifetimeSeconds: 300,
      allowExitOnIdle: true,
    });
    supabaseGlobals.__aviatorSupabaseDatabaseUrl = url;
  }
  return supabaseGlobals.__aviatorSupabasePool;
}

function normaliseKey(relativePath: string): string {
  const value = relativePath.replace(/\\/g, '/');
  const segments = value.split('/');
  if (
    !value ||
    value.startsWith('/') ||
    /^[a-zA-Z]:/.test(value) ||
    value.includes('\0') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new StorageWriteError('Refusing to access an invalid storage path');
  }
  return segments.join('/');
}

async function withClient<T>(task: (client: PoolClient) => Promise<T>): Promise<T> {
  const activeClient = transactionClient.getStore();
  if (activeClient) return task(activeClient);

  const client = await getPool().connect();
  try {
    return await task(client);
  } finally {
    client.release();
  }
}

async function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = withClient(async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          key text PRIMARY KEY,
          value text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await client.query(`ALTER TABLE ${TABLE_NAME} ENABLE ROW LEVEL SECURITY`);
      await client.query(`REVOKE ALL ON TABLE ${TABLE_NAME} FROM PUBLIC, anon, authenticated`);
    }).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

async function acquireAdvisoryLock(client: PoolClient, key: string): Promise<void> {
  await client.query(ADVISORY_LOCK_SQL, [key]);
}

async function runTransaction<T>(task: () => Promise<T>, lockKey?: string): Promise<T> {
  const activeClient = transactionClient.getStore();
  if (activeClient) {
    if (lockKey) await acquireAdvisoryLock(activeClient, lockKey);
    return task();
  }

  await ensureTable();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (lockKey) await acquireAdvisoryLock(client, lockKey);
    const result = await transactionClient.run(client, task);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Keep the original database/application error.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Supabase/Postgres-backed storage for Vercel and other serverless Node runtimes.
 * Collection documents share one private table. Receipt blobs live in the
 * private Supabase Storage uploads bucket and are read after route authorization.
 */
export function createPostgresDriver(): StorageDriver {
  return {
    mode: 'postgres',
    label: 'Supabase Postgres (serverless)',
    persistent: true,

    async ensureReady() {
      getSupabaseClient();
      await ensureTable();
    },

    async ensureDir(relativeDir) {
      if (relativeDir) normaliseKey(relativeDir);
      await ensureTable();
    },

    async read(relativePath) {
      await ensureTable();
      const key = normaliseKey(relativePath);
      return withClient(async (client) => {
        const result = await client.query<{ value: string }>(
          `SELECT value FROM ${TABLE_NAME} WHERE key = $1`,
          [key],
        );
        return result.rows[0]?.value ?? null;
      });
    },

    async write(relativePath, contents) {
      await ensureTable();
      const key = normaliseKey(relativePath);
      await withClient((client) =>
        client.query(
          `INSERT INTO ${TABLE_NAME} (key, value, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = now()`,
          [key, contents],
        ).then(() => undefined),
      );
    },

    async update(relativePath, updater) {
      await ensureTable();
      const key = normaliseKey(relativePath);
      let updatedValue: string | null = null;

      await runTransaction(async () => {
        const current = await withClient(async (client) => {
          const result = await client.query<{ value: string }>(
            `SELECT value FROM ${TABLE_NAME} WHERE key = $1 FOR UPDATE`,
            [key],
          );
          return result.rows[0]?.value ?? null;
        });

        updatedValue = await updater(current);
        if (typeof updatedValue !== 'string') {
          throw new StorageWriteError('A storage update must return text');
        }

        await withClient((client) =>
          client.query(
            `INSERT INTO ${TABLE_NAME} (key, value, updated_at)
             VALUES ($1, $2, now())
             ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = now()`,
            [key, updatedValue],
          ).then(() => undefined),
        );
      }, `document:${key}`);

      if (updatedValue === null) {
        throw new StorageWriteError('The storage update did not produce a value');
      }
      return updatedValue;
    },

    async remove(relativePath) {
      await ensureTable();
      const key = normaliseKey(relativePath);
      await withClient((client) =>
        client.query(`DELETE FROM ${TABLE_NAME} WHERE key = $1`, [key]).then(() => undefined),
      );
    },

    async list(relativeDir) {
      await ensureTable();
      const prefix = relativeDir ? `${normaliseKey(relativeDir)}/` : '';
      return withClient(async (client) => {
        const result = await client.query<{ key: string }>(
          `SELECT key FROM ${TABLE_NAME}
           WHERE left(key, char_length($1)) = $1
           ORDER BY key`,
          [prefix],
        );
        const children = new Set<string>();
        for (const row of result.rows) {
          const child = row.key.slice(prefix.length).split('/')[0];
          if (child) children.add(child);
        }
        return [...children].sort();
      });
    },

    async transaction<T>(task: () => Promise<T>, lockKey?: string) {
      return runTransaction(task, lockKey);
    },
  };
}
