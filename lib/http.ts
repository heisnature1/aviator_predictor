import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { FileValidationError } from '@/lib/storage/files';
import { StorageConfigurationError, StorageWriteError } from '@/lib/storage/database';

/**
 * HTTP helpers shared by every route handler.
 *
 * All error paths return a short, user friendly message. Stack traces, file
 * paths, keys and other internal details are logged server-side only.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(
    message: string,
    options: { status?: number; code?: string; fields?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 400;
    this.code = options.code ?? 'bad_request';
    this.fields = options.fields;
  }
}

export const Errors = {
  unauthorized: (message = 'Please sign in to continue.') =>
    new ApiError(message, { status: 401, code: 'unauthorized' }),
  forbidden: (message = 'You do not have permission to perform this action.') =>
    new ApiError(message, { status: 403, code: 'forbidden' }),
  notFound: (message = 'The requested resource was not found.') =>
    new ApiError(message, { status: 404, code: 'not_found' }),
  invalid: (message = 'The request was invalid.', fields?: Record<string, string>) =>
    new ApiError(message, { status: 400, code: 'invalid_request', fields }),
  conflict: (message = 'That action conflicts with the current state.') =>
    new ApiError(message, { status: 409, code: 'conflict' }),
  tooMany: (message = 'Too many attempts. Please wait a moment and try again.') =>
    new ApiError(message, { status: 429, code: 'rate_limited' }),
  server: (message = 'Something went wrong on our side. Please try again shortly.') =>
    new ApiError(message, { status: 500, code: 'server_error' }),
  serviceUnavailable: (message = 'The service is temporarily unavailable. Please try again shortly.') =>
    new ApiError(message, { status: 503, code: 'service_unavailable' }),
};

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code, fields: error.fields },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json(
      { ok: false, error: 'Please check the highlighted fields.', code: 'validation_error', fields },
      { status: 400 },
    );
  }

  if (error instanceof FileValidationError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: 'invalid_file' },
      { status: 400 },
    );
  }

  if (error instanceof StorageConfigurationError || error instanceof StorageWriteError) {
    console.error('[storage]', (error as Error).message);
    return NextResponse.json(
      { ok: false, error: (error as Error).message, code: 'storage_error' },
      { status: 503 },
    );
  }

  console.error('[api] unhandled error:', error);
  return NextResponse.json(
    { ok: false, error: 'Something went wrong on our side. Please try again shortly.', code: 'server_error' },
    { status: 500 },
  );
}

/** Wraps a route handler so nothing sensitive ever leaks to the client. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return fail(error);
    }
  };
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw Errors.invalid('The request body could not be read.');
  }
}

export function parseBody<T>(schema: ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw result.error;
  return result.data;
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip') ?? null;
}

export function userAgent(request: Request): string | null {
  const value = request.headers.get('user-agent');
  return value ? value.slice(0, 240) : null;
}

/**
 * Cheap same-origin check for state changing requests.
 * Uses the browser supplied Origin header, which cannot be spoofed by a
 * third-party page's JavaScript.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return; // non-browser client (curl/tests) — CSRF cookie still required
  const host = request.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw Errors.forbidden('Invalid request origin.');
  }
  if (host && originHost !== host) {
    throw Errors.forbidden('Cross-origin requests are not allowed.');
  }
}
