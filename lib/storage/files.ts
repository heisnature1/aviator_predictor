import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDriver, RECEIPTS_ROOT } from './database';

/**
 * Receipt file storage.
 * ---------------------------------------------------------------------------
 * Uploaded receipts are written to `storage/receipts/<user-id>/<id>.<ext>`.
 * The directory is NEVER publicly exposed: files are only ever served through
 * /api/receipts/[id], which authorises the request first (owner or admin).
 */

export const RECEIPT_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const;

export type ReceiptMime = keyof typeof RECEIPT_MIME_TYPES;

export const RECEIPT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

interface MagicSignature {
  mime: ReceiptMime;
  test: (bytes: Buffer) => boolean;
}

/**
 * Content sniffing — we never trust the browser supplied Content-Type alone.
 */
const SIGNATURES: MagicSignature[] = [
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    test: (b) =>
      b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
  { mime: 'application/pdf', test: (b) => b.toString('ascii', 0, 4) === '%PDF' },
];

export interface StoredReceipt {
  /** Path relative to the storage root, e.g. `receipts/<user>/<id>.png`. */
  relativePath: string;
  fileName: string;
  mime: ReceiptMime;
  size: number;
}

export interface IncomingFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

/**
 * Validates and stores an uploaded receipt.
 * Throws `FileValidationError` with a user-safe message on any problem.
 */
export async function storeReceipt(
  userId: string,
  file: IncomingFile,
  options: { maxBytes?: number } = {},
): Promise<StoredReceipt> {
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;

  if (!file || typeof file.size !== 'number') {
    throw new FileValidationError('The uploaded file could not be read.');
  }
  if (file.size === 0) {
    throw new FileValidationError('The uploaded file is empty.');
  }
  if (file.size > maxBytes) {
    throw new FileValidationError(
      `The receipt is too large. Maximum size is ${Math.floor(maxBytes / (1024 * 1024))}MB.`,
    );
  }

  const declared = (file.type || '').toLowerCase().split(';')[0].trim();
  const extensionFromName = (file.name || '').split('.').pop()?.toLowerCase() ?? '';
  if (
    !RECEIPT_EXTENSIONS.includes(extensionFromName as (typeof RECEIPT_EXTENSIONS)[number]) &&
    !(declared in RECEIPT_MIME_TYPES)
  ) {
    throw new FileValidationError('Unsupported file type. Upload a JPG, PNG, WEBP or PDF file.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new FileValidationError('The uploaded file is empty.');
  }
  if (buffer.byteLength > maxBytes) {
    throw new FileValidationError('The receipt is too large.');
  }

  const detected = SIGNATURES.find((signature) => signature.test(buffer));
  if (!detected) {
    throw new FileValidationError(
      'The file contents do not match a JPG, PNG, WEBP or PDF document.',
    );
  }
  if (declared && declared in RECEIPT_MIME_TYPES && RECEIPT_MIME_TYPES[declared as ReceiptMime] !== RECEIPT_MIME_TYPES[detected.mime]) {
    // The declared type disagrees with the actual bytes — trust the bytes.
  }

  const safeUserDir = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeUserDir) {
    throw new FileValidationError('Unable to determine where to store the receipt.');
  }

  const extension = RECEIPT_MIME_TYPES[detected.mime];
  const id = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}`;
  const fileName = `${id}.${extension}`;
  const relativePath = `receipts/${safeUserDir}/${fileName}`;
  const driver = getDriver();

  if (driver.mode !== 'local') {
    // Remote document drivers persist the receipt alongside collection data.
    // The value is base64 text; it is never exposed as a public URL.
    await driver.write(relativePath, buffer.toString('base64'));
    return { relativePath, fileName, mime: detected.mime, size: buffer.byteLength };
  }

  const targetDir = path.join(RECEIPTS_ROOT, safeUserDir);
  await fs.mkdir(targetDir, { recursive: true });

  const absolute = path.join(targetDir, fileName);
  const tmp = path.join(targetDir, `.${id}.${extension}.${randomBytes(4).toString('hex')}.tmp`);
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(buffer);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, absolute);

  return {
    relativePath: path.relative(path.dirname(RECEIPTS_ROOT), absolute).split(path.sep).join('/'),
    fileName,
    mime: detected.mime,
    size: buffer.byteLength,
  };
}

export interface ReadReceiptResult {
  buffer: Buffer;
  mime: string;
  fileName: string;
}

/** Reads a receipt by its stored relative path (e.g. `receipts/<user>/<file>`). */
export async function readReceipt(relativePath: string): Promise<ReadReceiptResult | null> {
  const key = relativePath.replace(/\\/g, '/');
  const segments = key.split('/');
  if (
    !key.startsWith('receipts/') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }

  const extension = path.posix.extname(key).slice(1).toLowerCase();
  if (!RECEIPT_EXTENSIONS.includes(extension as (typeof RECEIPT_EXTENSIONS)[number])) return null;

  const driver = getDriver();
  try {
    const buffer =
      driver.mode === 'local'
        ? await fs.readFile(path.join(path.dirname(RECEIPTS_ROOT), ...segments))
        : Buffer.from((await driver.read(key)) ?? '', 'base64');
    if (buffer.byteLength === 0) return null;
    const mime =
      extension === 'pdf'
        ? 'application/pdf'
        : extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : 'image/jpeg';
    return { buffer, mime, fileName: path.posix.basename(key) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteReceipt(relativePath: string): Promise<void> {
  const key = relativePath.replace(/\\/g, '/');
  const segments = key.split('/');
  if (
    !key.startsWith('receipts/') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return;
  }

  const driver = getDriver();
  if (driver.mode !== 'local') {
    await driver.remove(key);
    return;
  }

  try {
    await fs.unlink(path.join(path.dirname(RECEIPTS_ROOT), ...segments));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
