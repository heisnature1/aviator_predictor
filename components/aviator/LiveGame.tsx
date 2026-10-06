'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import { MultiplierDisplay } from './MultiplierDisplay';
import { GameStatus } from './GameStatus';
import { RoundHistory } from './RoundHistory';
import { get } from '@/lib/client/api';
import { Callout } from '@/components/ui/primitives';
import type { AviatorSnapshot } from '@/types';

/**
 * Live Aviator game panel.
 *
 * The component only ever renders data returned by /api/aviator/snapshot,
 * which in turn only returns data from the configured provider. When the feed
 * is unavailable the panel shows an explicit unavailable state — it does not
 * generate, estimate or animate placeholder "results".
 */
export function LiveGame({
  initialSnapshot,
  variant = 'full',
  historyLimit = 24,
}: {
  initialSnapshot: AviatorSnapshot;
  variant?: 'full' | 'compact';
  historyLimit?: number;
}) {
  const [snapshot, setSnapshot] = useState<AviatorSnapshot>(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const poll = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const next = await get<AviatorSnapshot>('/api/aviator/snapshot');
      if (!mounted.current) return;
      setSnapshot(next);
      setFailed(false);
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Poll faster while a round is in the air, slower otherwise.
    const interval = snapshot.current_status === 'flying' ? 800 : 2000;
    const timer = setInterval(() => {
      setRefreshing(true);
      void poll();
    }, interval);
    return () => clearInterval(timer);
  }, [poll, snapshot.current_status]);

  const unavailable = snapshot.connection !== 'connected';

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
            <Radio className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Live Aviator feed</h2>
            <p className="text-[11px] text-slate-500">
              {snapshot.is_simulated
                ? 'Local simulation, not real game data'
                : 'Data from the configured provider'}{' '}
              · updated {snapshot.fetched_at.slice(11, 19)} UTC
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus
            status={snapshot.connection}
            provider={snapshot.provider}
            compact
          />
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              void poll();
            }}
            className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
            aria-label="Refresh live feed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {snapshot.is_simulated ? (
        <div className="border-b border-white/10 px-5 py-3">
          <Callout tone="warning" title="Simulated development feed">
            These numbers come from the local simulator (AVIATOR_ALLOW_SIMULATION). They are
            <strong> not official Aviator game data</strong> and must not be used for real play.
            Configure <code className="rounded bg-black/30 px-1">AVIATOR_PROVIDER_URL</code> to
            connect an authorised source.
          </Callout>
        </div>
      ) : null}

      <div className="px-5 pb-5 pt-4">
        {unavailable ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <AlertTriangle className="h-7 w-7 text-coin-300" />
            <div>
              <p className="text-sm font-semibold text-white">
                {snapshot.connection === 'not_configured'
                  ? 'No Aviator data provider configured'
                  : failed
                    ? 'Cannot reach the Aviator data provider'
                    : 'Live feed unavailable'}
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
                {snapshot.message ??
                  'The platform only displays real provider data. Set AVIATOR_PROVIDER_URL to an authorised feed to populate this panel.'}
              </p>
            </div>
            <button type="button" onClick={poll} className="btn-secondary btn-sm">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry connection
            </button>
          </div>
        ) : (
          <MultiplierDisplay
            multiplier={snapshot.current_multiplier}
            status={snapshot.current_status}
            simulated={snapshot.is_simulated}
            size={variant === 'full' ? 'lg' : 'sm'}
          />
        )}

        <div className="mt-5 space-y-4">
          <GameStatus snapshot={snapshot} />
          <RoundHistory
            history={snapshot.history}
            limit={historyLimit}
            simulated={snapshot.is_simulated}
          />
        </div>
      </div>
    </section>
  );
}
