'use client';

import { DataTable, type Column } from '@/components/DataTable';
import { LocalTime } from '@/components/ui/LocalTime';
import { AUDIT_ACTION_LABELS } from '@/lib/audit/labels';
import type { AuditEntry } from '@/types';

export interface AuditRow {
  entry: AuditEntry;
  actor: string;
}

/**
 * Audit log table (client component — column renderers stay in the browser
 * bundle instead of crossing the server/client serialization boundary).
 */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const columns: Column<AuditRow>[] = [
    {
      key: 'timestamp',
      header: 'When',
      sortValue: (row) => row.entry.timestamp,
      render: (row) => (
        <span className="text-xs text-slate-300">
          <LocalTime iso={row.entry.timestamp} mode="datetime" />
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortValue: (row) => AUDIT_ACTION_LABELS[row.entry.action] ?? row.entry.action,
      render: (row) => (
        <span className="text-xs font-medium text-white">
          {AUDIT_ACTION_LABELS[row.entry.action] ?? row.entry.action}
        </span>
      ),
    },
    {
      key: 'admin',
      header: 'Administrator',
      sortValue: (row) => row.actor,
      render: (row) => <span className="text-xs text-slate-300">{row.actor}</span>,
      hideOnMobile: true,
    },
    {
      key: 'target',
      header: 'Target',
      sortValue: (row) => row.entry.target_label ?? row.entry.target_user ?? '',
      render: (row) => (
        <span className="block max-w-[240px] truncate text-xs text-slate-300">
          {row.entry.target_label ?? row.entry.target_user ?? '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'change',
      header: 'Change',
      render: (row) => (
        <span className="block max-w-[260px] truncate text-[11px] text-slate-400">
          {row.entry.previous_value ? `${row.entry.previous_value} → ` : ''}
          {row.entry.new_value ?? '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'reason',
      header: 'Reason',
      sortValue: (row) => row.entry.reason ?? '',
      render: (row) => (
        <span className="block max-w-[220px] truncate text-[11px] text-slate-400">
          {row.entry.reason ?? '—'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'ip',
      header: 'IP',
      render: (row) => (
        <span className="font-mono text-[11px] text-slate-500">{row.entry.ip_address ?? '—'}</span>
      ),
      hideOnMobile: true,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.entry.id}
      searchPlaceholder="Search logs…"
      emptyTitle="No matching entries"
      initialSort={{ key: 'timestamp', direction: 'desc' }}
    />
  );
}
