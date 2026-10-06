'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, Coins, Gem, Loader2, Sparkles } from 'lucide-react';
import { post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import { PredictionResult } from '@/components/PredictionResult';
import type { Prediction, WalletCurrency } from '@/types';

interface RequestResponse {
  prediction: Prediction;
  charged: boolean;
  gems_remaining: number;
  coins_remaining: number;
}

export function PredictionPanel({
  signedIn,
  accountStatus,
  balance,
  cost,
  initialHistory = [],
  compact = false,
}: {
  signedIn: boolean;
  accountStatus?: string | null;
  balance: { gems: number; coins: number };
  cost: { gems: number; coins: number };
  initialHistory?: Prediction[];
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(initialHistory[0] ?? null);
  const [gems, setGems] = useState(balance.gems);

  const costLabel = [
    cost.gems > 0 ? `${cost.gems} gems` : null,
    cost.coins > 0 ? `${cost.coins} coins` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  const blockedReason = !signedIn
    ? 'Sign in to request an analysis.'
    : accountStatus !== 'active'
      ? accountStatus === 'pending'
        ? 'Activate your account to unlock predictions.'
        : 'Your account is not active.'
      : gems < cost.gems
        ? 'Insufficient gems — top up your wallet.'
        : null;

  async function requestPrediction() {
    setLoading(true);
    setError(null);
    try {
      const result = await post<RequestResponse>('/api/predictions/request');
      setPrediction(result.prediction);
      setGems(result.gems_remaining);
      if (result.prediction.status === 'generated') {
        toast.success('Analysis ready', `${result.prediction.estimated_min?.toFixed(2)}x – ${result.prediction.estimated_max?.toFixed(2)}x`);
      } else {
        toast.info('No estimate produced', 'Not enough live data — no credits were used.');
      }
      router.refresh();
    } catch (caught) {
      const message = (caught as Error).message;
      setError(message);
      toast.error('Could not generate analysis', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gem-500/15 text-gem-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Request prediction</h2>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              Statistical analysis of recent rounds
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-5 py-5">
        {prediction && !compact ? (
          <PredictionResult prediction={prediction} />
        ) : prediction ? (
          <button
            type="button"
            onClick={() => setPrediction(null)}
            className="btn-secondary btn-sm w-full"
          >
            Request a new analysis
          </button>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <p className="panel-title">Credits required</p>
            <span className="text-sm font-semibold text-white">{costLabel || 'Free'}</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Gem className="h-3.5 w-3.5 text-gem-300" />
              Your gems
            </span>
            <span className="font-semibold text-white tabular">{gems.toLocaleString()}</span>
          </div>
          {cost.coins > 0 ? (
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-coin-300" />
                Your coins
              </span>
              <span className="font-semibold text-white tabular">{balance.coins.toLocaleString()}</span>
            </div>
          ) : null}
        </div>

        {blockedReason ? (
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-xl border border-coin-400/25 bg-coin-500/10 px-3 py-2.5 text-xs text-coin-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {blockedReason}
            </div>
            {!signedIn ? (
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" className="btn-secondary btn-sm">
                  Login
                </Link>
                <Link href="/register" className="btn-primary btn-sm">
                  Create Account
                </Link>
              </div>
            ) : accountStatus !== 'active' ? (
              <Link href="/payments" className="btn-primary w-full">
                Activate account
              </Link>
            ) : (
              <Link href="/wallet" className="btn-primary w-full">
                Buy credits
              </Link>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary w-full py-3 text-base"
            onClick={requestPrediction}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Predict
              </>
            )}
          </button>
        )}

        {error ? (
          <p className="rounded-xl border border-danger-500/25 bg-danger-500/10 px-3 py-2.5 text-xs text-danger-300">
            {error}
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-slate-500">
          Predictions are generated server-side from the live provider feed using descriptive
          statistics. They are <strong className="text-slate-400">not</strong> a guaranteed
          outcome, a fixed crash point, or a promise of profit.{' '}
          {cost.gems > 0 ? 'Credits are only deducted when an estimate is produced.' : ''}
        </p>
      </div>
    </section>
  );
}

export type { WalletCurrency };
