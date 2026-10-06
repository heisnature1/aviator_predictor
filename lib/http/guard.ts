import { assertSameOrigin, Errors, clientIp } from '@/lib/http';
import { assertCsrf } from '@/lib/auth/csrf';
import { guardRate, LIMITS } from '@/lib/auth/rate-limit';

/**
 * Shared guards for state changing API routes:
 *   • same-origin check (blocks cross-site form posts)
 *   • CSRF double-submit token
 *   • rate limit
 */
export function assertSafeMutation(
  request: Request,
  policy: { limit: number; windowMs: number } = LIMITS.api,
): void {
  assertSameOrigin(request);
  assertCsrf(request);
  guardRate(`mutation:${clientIp(request) ?? 'unknown'}`, policy);
}

export async function readFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw Errors.invalid('The upload could not be processed. Please try a smaller file.');
  }
}

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export interface UploadedFileLike {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export function formFile(form: FormData, key: string): UploadedFileLike | null {
  const value = form.get(key);
  if (!value || typeof value === 'string') return null;
  const file = value as unknown as UploadedFileLike;
  if (typeof file.arrayBuffer !== 'function') return null;
  return file;
}
