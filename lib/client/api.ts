import { CSRF_COOKIE, CSRF_HEADER } from '@/lib/auth/constants';

/**
 * Browser helper for talking to the platform API.
 *
 * • attaches the CSRF token from the readable cookie on every mutation
 * • refreshes the token automatically when it is missing/expired
 * • normalises errors so components can render `error.message` directly
 */

export class ApiClientError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;

  constructor(message: string, status: number, code: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

async function ensureCsrf(): Promise<string | null> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  return readCsrfCookie();
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  fields?: Record<string, string>;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== 'GET' && method !== 'HEAD') {
    const token = await ensureCsrf();
    if (token) headers.set(CSRF_HEADER, token);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !payload?.ok) {
    const status = response.status;
    // A stale CSRF cookie is the most common 403 — refresh once and retry.
    if (status === 403 && retry && method !== 'GET') {
      await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
      return request<T>(path, init, false);
    }
    throw new ApiClientError(
      payload?.error ?? 'Something went wrong. Please try again.',
      status,
      payload?.code ?? 'unknown',
      payload?.fields ?? {},
    );
  }

  return payload.data as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
