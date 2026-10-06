/**
 * Client-safe formatting helpers (no Node built-ins).
 *
 * Kept separate from lib/utils.ts so browser bundles never pull in
 * `node:crypto` or other server-only modules.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Deterministic (UTC based) timestamp for server rendered output.
 * Client components should use <LocalTime> to show the visitor's timezone.
 */
export function formatDateTimeUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(11, 19);
}

export function formatCurrency(amount: number, currencyCode = 'GHS'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${currencyCode} ${safe.toLocaleString('en-US', {
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** Stable sort by a numeric/string key without mutating the input. */
export function sortBy<T>(values: T[], selector: (value: T) => number | string): T[] {
  return [...values].sort((a, b) => {
    const left = selector(a);
    const right = selector(b);
    if (left === right) return 0;
    return left > right ? 1 : -1;
  });
}

export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}
