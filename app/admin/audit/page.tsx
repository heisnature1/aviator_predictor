import type { Metadata } from 'next';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { AuditTable, type AuditRow } from '@/components/admin/AuditTable';
import { requireAdmin } from '@/lib/auth/session';
import { listAudit, AUDIT_ACTION_LABELS } from '@/lib/audit/audit-service';
import { listUsers } from '@/lib/users/user-service';
import type { AuditEntry } from '@/types';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Activity Logs' };

export default async function AdminAuditPage() {
  await requireAdmin();
  const [entries, users] = await Promise.all([listAudit(500), listUsers()]);

  const actorName = (id: string | null) =>
    id ? users.find((item) => item.id === id)?.full_name ?? 'Removed user' : 'System';

  const rows: AuditRow[] = entries.map((entry) => ({
    entry,
    actor: actorName(entry.admin_id),
  }));

  const byAction = entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.action] = (accumulator[entry.action] ?? 0) + 1;
    return accumulator;
  }, {});

  const topActions = Object.entries(byAction)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Activity logs"
        subtitle="Immutable record of every administrative action, payment event and prediction request."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Entries" value={entries.length} />
        {topActions.map(([action, count]) => (
          <StatCard
            key={action}
            label={AUDIT_ACTION_LABELS[action as AuditEntry['action']] ?? action}
            value={count}
          />
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No activity recorded"
          message="Approvals, adjustments and settings changes will appear here."
        />
      ) : (
        <AuditTable rows={rows} />
      )}
    </div>
  );
}
