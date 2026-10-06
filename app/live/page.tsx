import type { Metadata } from 'next';
import Link from 'next/link';
import { Database, ShieldAlert, Sparkles } from 'lucide-react';
import { LiveGame } from '@/components/aviator/LiveGame';
import { PredictionPanel } from '@/components/PredictionPanel';
import { Callout, PageHeader } from '@/components/ui/primitives';
import { getFeedDiagnostics, getLiveFeed } from '@/lib/aviator/live-feed';
import { getCurrentUser } from '@/lib/auth/session';
import { getSystemSettings } from '@/lib/settings/settings-service';
import { getBalances } from '@/lib/wallet/wallet-service';
import { listUserPredictions } from '@/lib/predictions/prediction-history';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Live Game' };

export default async function LivePage() {
  const [snapshot, diagnostics, settings, context] = await Promise.all([
    getLiveFeed(),
    Promise.resolve(getFeedDiagnostics()),
    getSystemSettings(),
    getCurrentUser(),
  ]);

  const user = context?.user ?? null;
  const balance = user ? await getBalances(user.id) : { gems: 0, coins: 0 };
  const history = user ? await listUserPredictions(user.id, 1) : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Live Aviator feed"
        subtitle="Round state, multiplier and history as reported by the configured data provider. The platform never generates values of its own."
        actions={
          <Link href="/predictions" className="btn-secondary btn-sm">
            <Sparkles className="h-4 w-4" />
            Prediction history
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <LiveGame initialSnapshot={snapshot} historyLimit={48} />
        </div>

        <div className="space-y-5 lg:col-span-2">
          <PredictionPanel
            signedIn={Boolean(user)}
            accountStatus={user?.account_status ?? null}
            balance={balance}
            cost={{ gems: settings.prediction_cost_gems, coins: settings.prediction_cost_coins }}
            initialHistory={history}
          />

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Database className="h-4 w-4 text-slate-400" />
              Feed diagnostics
            </h2>
            <dl className="space-y-2 text-xs">
              {[
                ['Provider', diagnostics.provider],
                ['Mode', diagnostics.mode],
                ['Configured', diagnostics.configured ? 'yes' : 'no'],
                ['Simulation enabled', diagnostics.simulation_enabled ? 'yes' : 'no'],
                ['Last success', diagnostics.last_success_at?.slice(11, 19) ?? '—'],
                ['Last error', diagnostics.last_error ?? 'none'],
                ['Rounds held', String(snapshot.history.length)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="truncate font-medium text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Callout tone="info" title="Live result vs platform analysis" icon={<ShieldAlert className="h-4 w-4" />}>
            The panel above shows the <strong>live game result</strong> reported by the provider.
            Anything labelled <strong>prediction</strong> or <strong>analysis</strong> is our
            statistical read of past rounds — it is never an official result and never a guarantee.
          </Callout>
        </div>
      </div>
    </div>
  );
}
