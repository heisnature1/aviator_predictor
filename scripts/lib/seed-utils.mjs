/**
 * Shared helpers for the seed / reset scripts.
 *
 * These run in plain Node (no TypeScript toolchain) and duplicate only the
 * small amount of knowledge the runtime needs: where files live, the seed
 * defaults and the scrypt password format.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

/**
 * Minimal .env.local loader so the scripts behave the same as `next dev`.
 * Real variables in the environment always win.
 */
async function loadEnvFile() {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(path.resolve(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        if (process.env[key] !== undefined) continue;
        const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn(`[env] could not read ${file}:`, error.message);
    }
  }
}

await loadEnvFile();

export const ROOT = path.resolve(process.cwd());
export const DATA_ROOT = path.resolve(ROOT, process.env.DATA_DIR || 'data');
export const STORAGE_ROOT = path.resolve(ROOT, process.env.STORAGE_DIR || 'storage');
export const RECEIPTS_ROOT = path.join(STORAGE_ROOT, 'receipts');

export const COLLECTIONS = {
  users: 'users/users.json',
  sessions: 'sessions/sessions.json',
  wallets: 'wallets/wallets.json',
  transactions: 'transactions/transactions.json',
  payments: 'payments/payments.json',
  purchases: 'purchases/purchases.json',
  predictions: 'predictions/predictions.json',
  notifications: 'notifications/notifications.json',
  settings: 'settings/settings.json',
  packages: 'packages/packages.json',
  audit: 'audit/activity.json',
};

export const DEFAULT_PAYMENT_SETTINGS = {
  activation_fee: 50,
  currency_code: 'GHS',
  payment_method: 'MTN Mobile Money',
  payment_number: '024 000 0000',
  account_name: 'Aviator Insights Ltd',
  payment_instructions:
    'Send the exact amount to the number below using the reference shown on your account page. Upload a clear screenshot or photo of the confirmation message so we can verify the payment.',
  support_contact: 'support@aviatorinsights.example',
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const DEFAULT_SYSTEM_SETTINGS = {
  site_name: 'Aviator Insights',
  tagline: 'Live round analytics for the Aviator crash game',
  prediction_cost_gems: 10,
  prediction_cost_coins: 0,
  activation_bonus_gems: 50,
  activation_bonus_coins: 25,
  min_data_points: 20,
  history_window: 120,
  low_balance_threshold: 25,
  max_receipt_bytes: 5 * 1024 * 1024,
  maintenance_mode: false,
  registration_open: true,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const DEFAULT_PACKAGES = [
  ['pkg_gems_100', '100 Gems', 'gems', 100, 20, 'Starter bundle', 1],
  ['pkg_gems_250', '250 Gems', 'gems', 250, 40, 'Most popular', 2],
  ['pkg_gems_500', '500 Gems', 'gems', 500, 70, 'Best value', 3],
  ['pkg_gems_1000', '1000 Gems', 'gems', 1000, 120, 'High roller', 4],
  ['pkg_coins_200', '200 Coins', 'coins', 200, 30, 'Secondary credit', 5],
].map(([id, name, currency, credits, price, description, sort_order]) => ({
  id,
  name,
  currency,
  credits,
  price,
  currency_code: 'GHS',
  active: true,
  sort_order,
  description,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}));

export function newId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function nowIso(offsetMs = 0) {
  return new Date(Date.now() + offsetMs).toISOString();
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function ensureDirectories() {
  await fs.mkdir(RECEIPTS_ROOT, { recursive: true });
  for (const relative of Object.values(COLLECTIONS)) {
    await fs.mkdir(path.join(DATA_ROOT, path.dirname(relative)), { recursive: true });
  }
}

export async function readJson(name) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_ROOT, COLLECTIONS[name]), 'utf8'));
  } catch {
    return null;
  }
}

export async function writeJson(name, value) {
  const target = path.join(DATA_ROOT, COLLECTIONS[name]);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, target);
}

export function defaultFor(name) {
  switch (name) {
    case 'settings':
      return { payments: DEFAULT_PAYMENT_SETTINGS, system: DEFAULT_SYSTEM_SETTINGS };
    case 'packages':
      return DEFAULT_PACKAGES;
    default:
      return [];
  }
}

/** Creates every missing file with its seed value. Existing files are kept. */
export async function initialiseStore({ force = false } = {}) {
  await ensureDirectories();
  const created = [];
  for (const name of Object.keys(COLLECTIONS)) {
    const existing = force ? null : await readJson(name);
    if (existing === null) {
      await writeJson(name, defaultFor(name));
      created.push(COLLECTIONS[name]);
    }
  }
  return created;
}

/**
 * Builds a small, valid PDF "receipt" so the receipt viewer can be exercised
 * with demo data without bundling binary files in the repository.
 */
export function buildReceiptPdf(lines) {
  const esc = (value) => value.replace(/([\\()])/g, '\\$1');
  const content = [
    'BT',
    '/F1 14 Tf',
    '24 760 Td',
    ...lines.flatMap((line, index) => [
      index === 0 ? '' : '0 -22 Td',
      index === 0 ? `/F1 16 Tf (${esc(line)}) Tj` : `/F1 12 Tf (${esc(line)}) Tj`,
    ]),
    'ET',
  ].join('\n');

  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 820]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${Buffer.byteLength(content)}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

export async function writeReceipt(userId, fileName, buffer) {
  const dir = path.join(RECEIPTS_ROOT, userId.replace(/[^a-zA-Z0-9_-]/g, ''));
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, fileName);
  const tmp = `${target}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, target);
  return `receipts/${path.relative(RECEIPTS_ROOT, target).split(path.sep).join('/')}`;
}
