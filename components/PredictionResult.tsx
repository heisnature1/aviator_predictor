'use client';

import { useState } from 'react';
import { BarChart3, ChevronDown, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import { CONFIDENCE_LABELS } from '@/lib/predictions/prediction-engine';
import { LocalTime } from '@/components/ui/LocalTime';
import { Callout } from '@/components/ui/primitives';
import type { Prediction } from '@/types';

const CONFIDENCE_TONE: Record<Prediction['confidence'], string> = {
  insufficient: 'text-slate-400',
  low: 'text-coin-300',
  moderate: 'text-accent-300',
  high: 'text-success-400',
};

/**
 * Analysis result card.
 *
 * Deliberately titled "PLATFORM ANALYSIS" and visually separated from the live
 * game panel: a prediction is our statistical read of past rounds, never an
 * official game result and never a guarantee.
 */
export function PredictionResult({
  prediction,
  compact = false,
}: {
  prediction: Prediction;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const generated = prediction.status === 'generated';

  return (
    <div className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gem-500/15 text-gem-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">Prediction result</h3>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              Platform analysis · not a game result
            </p>
          </div>
        </div>
        <LocalTime iso={prediction.created_at} mode="time" className="text-[11px] text-slate-500" />
      </header>

      <div className="space-y-4 px-5 py-5">
        {generated && prediction.estimated_min !== null && prediction.estimated_max !== null ? (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gem-500/10 via-white/[0.03] to-transparent p-4">
            <p className="panel-title">Estimated range</p>
            <p className="mt-1.5 font-display text-3xl font-bold tabular text-white sm:text-4xl">
              {prediction.estimated_min.toFixed(2)}x
              <span className="mx-2 text-slate-500">–</span>
              {prediction.estimated_max.toFixed(2)}x
            </p>
            <p className={`mt-2 text-xs font-semibold ${CONFIDENCE_TONE[prediction.confidence]}`}>
              {CONFIDENCE_LABELS[prediction.confidence]}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-coin-400/25 bg-coin-500/10 p-4">
            <p className="text-sm font-semibold text-coin-200">
              {prediction.status === 'insufficient_data'
                ? 'Not enough live data for an estimate'
                : 'Analysis unavailable'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-coin-100/80">{prediction.summary}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wider text-slate-500">Data used</dt>
            <dd className="mt-1 font-semibold text-white">
              {prediction.data_points} recent rounds
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
              <Clock className="h-3 w-3" /> Generated
            </dt>
            <dd className="mt-1 font-semibold text-white">
              <LocalTime iso={prediction.created_at} mode="time" />
            </dd>
          </div>
        </dl>

        {prediction.data_source === 'simulation' ? (
          <Callout tone="warning" title="Based on simulated data">
            This analysis used the local simulator, not real game data. It is shown for
            development only.
          </Callout>
        ) : null}

        {prediction.analysis.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5" />
                View analysis
              </span>
              <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded ? (
              <dl className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
                {prediction.analysis.map((point, index) => (
                  <div key={`${point.label}-${index}`} className="flex items-start justify-between gap-4 bg-white/[0.02] px-3 py-2.5">
                    <dt className="text-xs text-slate-400">{point.label}</dt>
                    <dd className="text-right text-xs font-semibold text-white">
                      {point.value}
                      {point.note ? (
                        <span className="block font-normal text-[11px] text-slate-500">{point.note}</span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-coin-300" />
          <p className="text-[11px] leading-relaxed text-slate-400">{prediction.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
