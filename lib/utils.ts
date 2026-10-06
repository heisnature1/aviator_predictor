import { randomUUID } from 'node:crypto';

/** Prefixed, collision-free identifier: `usr_lk3j2...` */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export * from './format';
