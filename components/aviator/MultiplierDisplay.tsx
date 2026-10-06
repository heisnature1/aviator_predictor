'use client';

import type { AviatorRoundStatus } from '@/types';

/**
 * Large multiplier readout.
 *
 * Displays whatever the provider reported. When the feed is unavailable it
 * shows an explicit placeholder — it never invents a number.
 */
export function MultiplierDisplay({
  multiplier,
  status,
  simulated = false,
  size = 'lg',
}: {
  multiplier: number | null;
  status: AviatorRoundStatus;
  simulated?: boolean;
  size?: 'sm' | 'lg';
}) {
  const crashed = status === 'crashed';
  const flying = status === 'flying';

  const tone = multiplier === null
    ? 'text-slate-600'
    : crashed
      ? 'text-danger-400'
      : flying
        ? 'text-white'
        : 'text-slate-300';

  const value = multiplier === null ? '--.--' : multiplier.toFixed(2);

  return (
    <div className="relative flex flex-col items-center justify-center py-2">
      <div
        className={`pointer-events-none absolute inset-0 mx-auto h-32 w-32 rounded-full blur-3xl ${
          flying ? 'bg-brand-500/25' : crashed ? 'bg-danger-500/20' : 'bg-accent-500/10'
        }`}
      />
      <div className="relative flex items-baseline gap-1">
        <span
          className={`font-display font-bold tabular tracking-tighter transition-colors duration-300 ${
            size === 'lg' ? 'text-6xl sm:text-7xl lg:text-8xl' : 'text-4xl'
          } ${tone} ${flying ? 'drop-shadow-[0_0_25px_rgba(249,115,22,0.45)]' : ''}`}
        >
          {value}
        </span>
        <span
          className={`font-display font-bold ${size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl'} ${tone}`}
        >
          x
        </span>
      </div>

      <div className="relative mt-2 flex items-center gap-2">
        <span
          className={`badge ${
            multiplier === null
              ? 'badge-muted'
              : crashed
                ? 'badge-danger'
                : flying
                  ? 'badge-warning'
                  : 'badge-info'
          }`}
        >
          {multiplier === null
            ? 'No data'
            : crashed
              ? 'Crashed'
              : flying
                ? 'Flying'
                : status === 'betting'
                  ? 'Betting open'
                  : status === 'waiting'
                    ? 'Waiting'
                    : status}
        </span>
        {simulated ? (
          <span className="badge-warning" title="Local simulator — not official game data">
            Simulated
          </span>
        ) : null}
      </div>
    </div>
  );
}
