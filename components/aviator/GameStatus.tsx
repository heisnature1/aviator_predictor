'use client';

import { Clock, Hash } from 'lucide-react';
import type { AviatorRoundStatus, AviatorSnapshot } from '@/types';

const STATUS_LABELS: Record<AviatorRoundStatus, string> = {
  waiting: 'Preparing next round',
  betting: 'Betting window open',
  flying: 'Round in progress',
  crashed: 'Round ended',
  unknown: 'State unknown',
};

export function GameStatus({ snapshot }: { snapshot: AviatorSnapshot }) {
  const rows: { label: string; value: string; icon: React.ReactNode }[] = [
    {
      label: 'Round',
      value: snapshot.current_round_id ?? '—',
      icon: <Hash className="h-3.5 w-3.5" />,
    },
    {
      label: 'Status',
      value: STATUS_LABELS[snapshot.current_status] ?? snapshot.current_status,
      icon: <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />,
    },
    {
      label: 'Feed updated',
      value: snapshot.updated_at ? `${snapshot.updated_at.slice(11, 19)} UTC` : '—',
      icon: <Clock className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
        >
          <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
            {row.icon}
            {row.label}
          </dt>
          <dd className="truncate text-xs font-semibold text-white">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
