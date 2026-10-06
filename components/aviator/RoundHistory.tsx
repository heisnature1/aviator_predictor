'use client';

import { History } from 'lucide-react';
import type { AviatorRound } from '@/types';

function toneFor(multiplier: number): string {
  if (multiplier >= 10) return 'bg-gem-500/20 text-gem-300 border-gem-500/40';
  if (multiplier >= 3) return 'bg-accent-500/15 text-accent-300 border-accent-400/30';
  if (multiplier >= 2) return 'bg-success-500/15 text-success-400 border-success-500/30';
  if (multiplier >= 1.5) return 'bg-coin-500/10 text-coin-300 border-coin-400/25';
  return 'bg-white/5 text-slate-400 border-white/10';
}

export function RoundHistory({
  history,
  limit = 24,
  simulated = false,
}: {
  history: AviatorRound[];
  limit?: number;
  simulated?: boolean;
}) {
  const rounds = history.slice(0, limit);

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="panel-title">Round history</p>
        {simulated ? <span className="badge-warning">simulated</span> : null}
      </div>

      {rounds.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-slate-400">
          <History className="h-4 w-4 shrink-0" />
          No round history available from the configured provider yet.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {rounds.map((round, index) => (
              <span
                key={`${round.round_id}-${index}`}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold tabular transition ${toneFor(
                  round.multiplier ?? 1,
                )} ${index === 0 ? 'ring-1 ring-white/20' : ''}`}
                title={`Round ${round.round_id} · ${
                  round.ended_at ? new Date(round.ended_at).toISOString().slice(11, 19) + ' UTC' : ''
                }`}
              >
                {(round.multiplier ?? 0).toFixed(2)}x
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] text-slate-500">
            Most recent {rounds.length} completed rounds{' '}
            {simulated
              ? 'from the local simulator — not official game data.'
              : 'reported by the configured provider.'}
          </p>
        </>
      )}
    </div>
  );
}
