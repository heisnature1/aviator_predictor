import { auditCollection } from '@/lib/storage/collections';
import { newId, nowIso } from '@/lib/utils';
import { AUDIT_ACTION_LABELS } from './labels';
import type { AuditAction, AuditEntry } from '@/types';

/**
 * Audit log.
 *
 * Every administrative action (payments, purchases, account status, wallet
 * adjustments, settings and package changes) is appended here. Entries are
 * immutable — there is no update or delete path.
 */

const MAX_ENTRIES = 5000;

export interface AuditInput {
  admin_id?: string | null;
  action: AuditAction;
  target_user?: string | null;
  target_label?: string | null;
  previous_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
  ip_address?: string | null;
}

export async function recordAudit(input: AuditInput): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: newId('log'),
    admin_id: input.admin_id ?? null,
    action: input.action,
    target_user: input.target_user ?? null,
    target_label: input.target_label ?? null,
    previous_value: input.previous_value ?? null,
    new_value: input.new_value ?? null,
    reason: input.reason ?? null,
    timestamp: nowIso(),
    ip_address: input.ip_address ?? null,
  };

  await auditCollection.mutate((entries) => {
    const next = [...entries, entry];
    return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
  });

  return entry;
}

export async function listAudit(limit = 500): Promise<AuditEntry[]> {
  const entries = await auditCollection.read();
  return entries.slice(-limit).reverse();
}

export async function listAuditForUser(userId: string, limit = 100): Promise<AuditEntry[]> {
  const entries = await auditCollection.read();
  return entries
    .filter((entry) => entry.target_user === userId || entry.admin_id === userId)
    .slice(-limit)
    .reverse();
}

export { AUDIT_ACTION_LABELS } from './labels';
