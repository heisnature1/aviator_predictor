import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/ui/primitives';
import { PredictionPanel } from '@/components/PredictionPanel';
import { PredictionResult } from '@/components/PredictionResult';
import { requireUser } from '@/lib/auth/session';
import { getBalances } from '@/lib/wallet/wallet-service';
import { getSystemSettings } from '@/lib/settings/settings-service';
import { listUserPredictions } from '@/lib/predictions/prediction-history';
import { getLiveFeed } from '@/lib/aviator/live-feed';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Predictions' };

export default async function PredictionsPage() {
  const { user } = await requireUser();

  const [balance, settings, predictions, snapshot] = await Promise.all([
    getBalances(user.id),
    getSystemSettings(),
    listUserPredictions(user.id, 30),
    getLiveFeed(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Predictions"
        subtitle="Request an analysis and review every estimate the platform has produced for your account."
        actions={
          <Link href="/wallet" className="btn-secondary btn-sm">
            Buy credits
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <PredictionPanel
            signedIn
            accountStatus={user.account_status}
            balance={balance}
            cost={{ gems: settings.prediction_cost_gems, coins: settings.prediction_cost_coins }}
          />

          <div className="card mt-5 p-5">
            <h2 className="text-sm font-semibold text-white">Feed status</h2>
            <p className="mt-1.5 text-xs text-slate-400">
              {snapshot.connection === 'connected'
                ? `Connected to ${snapshot.provider}. ${snapshot.history.length} rounds available.`
                : 'The live feed is unavailable, so analyses cannot be generated right now.'}
            </p>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gem-300" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              Prediction history
            </h2>
          </div>

          {predictions.length === 0 ? (
            <EmptyState
              title="No predictions yet"
              message="Request your first analysis — credits are only deducted when an estimate is produced."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {predictions.map((prediction) => (
                <PredictionResult key={prediction.id} prediction={prediction} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
