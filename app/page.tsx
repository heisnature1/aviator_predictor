import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Coins,
  Gem,
  Radio,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { LiveGame } from '@/components/aviator/LiveGame';
import { PredictionPanel } from '@/components/PredictionPanel';
import { getCurrentUser } from '@/lib/auth/session';
import { getLiveFeed } from '@/lib/aviator/live-feed';
import { getPaymentSettings, getSystemSettings } from '@/lib/settings/settings-service';
import { getBalances } from '@/lib/wallet/wallet-service';
import { listPackages } from '@/lib/packages/package-service';
import { listUserPredictions } from '@/lib/predictions/prediction-history';
import { formatCurrency } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [snapshot, settings, paymentSettings, context, packages] = await Promise.all([
    getLiveFeed(),
    getSystemSettings(),
    getPaymentSettings(),
    getCurrentUser(),
    listPackages(),
  ]);

  const user = context?.user ?? null;
  const balance = user ? await getBalances(user.id) : { gems: 0, coins: 0 };
  const history = user ? await listUserPredictions(user.id, 1) : [];

  const features = [
    {
      icon: Radio,
      title: 'Provider-backed live feed',
      body: 'Round data is read from a configurable Aviator provider. No provider means no numbers — we never invent results.',
    },
    {
      icon: BarChart3,
      title: 'Honest statistical analysis',
      body: 'Descriptive statistics over recent rounds: survival curve, dispersion, momentum. Stated limits, no magic claims.',
    },
    {
      icon: Wallet,
      title: 'Wallet, gems & coins',
      body: 'Every credit movement writes a ledger row with balance before and after. Balances can only change server-side.',
    },
    {
      icon: ShieldCheck,
      title: 'Human-verified payments',
      body: 'Upload a receipt and an administrator reviews it. Nothing is approved automatically and credits are never granted by an upload.',
    },
    {
      icon: Activity,
      title: 'Full audit trail',
      body: 'Every administrative action — approvals, adjustments, settings — is logged with actor, values and reason.',
    },
    {
      icon: BadgeCheck,
      title: 'Prediction history',
      body: 'Each analysis is stored with the data points used, the estimated band and the exact disclaimer shown to you.',
    },
  ];

  const steps = [
    {
      title: 'Create your account',
      body: 'Register with your details. The account starts as pending — activation is verified manually.',
    },
    {
      title: 'Complete activation',
      body: `Send the ${formatCurrency(
        paymentSettings.activation_fee,
        paymentSettings.currency_code,
      )} activation fee and upload your receipt for review.`,
    },
    {
      title: 'Add credits & analyse',
      body: 'Buy a gem or coin bundle, then request an analysis. Credits are only spent when an estimate is produced.',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-850/80 via-ink-900/60 to-transparent px-5 py-10 sm:px-8 sm:py-14">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-accent-500/15 blur-3xl" />

        <div className="relative max-w-3xl">
          <span className="badge-info">
            <Radio className="h-3 w-3" />
            Live round analytics
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Aviator round insights,
            <span className="block bg-gradient-to-r from-brand-300 via-brand-400 to-coin-300 bg-clip-text text-transparent">
              built on real data only
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Track the live game feed, run statistical analysis over recent rounds and keep every
            credit movement in a ledger. We do not fabricate game results and we never promise a
            win — what you get is a transparent, auditable analysis platform.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/live" className="btn-primary px-6 py-3 text-base">
              <Radio className="h-4 w-4" />
              Open live game
            </Link>
            {user ? (
              <Link href="/dashboard" className="btn-secondary px-6 py-3 text-base">
                Go to dashboard
              </Link>
            ) : (
              <Link href="/register" className="btn-secondary px-6 py-3 text-base">
                Create Account
              </Link>
            )}
          </div>

          <dl className="mt-9 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Live feed source', value: snapshot.provider },
              { label: 'Analysis cost', value: `${settings.prediction_cost_gems} gems` },
              { label: 'Rounds in window', value: String(snapshot.history.length) },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">{item.label}</dt>
                <dd className="mt-1 truncate text-sm font-semibold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Live game + prediction */}
      <section className="mt-8 grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <LiveGame initialSnapshot={snapshot} historyLimit={18} />
        </div>
        <div className="lg:col-span-2">
          <PredictionPanel
            signedIn={Boolean(user)}
            accountStatus={user?.account_status ?? null}
            balance={balance}
            cost={{ gems: settings.prediction_cost_gems, coins: settings.prediction_cost_coins }}
            initialHistory={history}
          />
        </div>
      </section>

      {/* Features */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          A platform, not a promise
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Everything below exists in the product today — real accounts, real approvals, real ledger
          entries.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="card p-5 transition hover:border-white/20">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-400">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{feature.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Credit packages */}
      {packages.length > 0 ? (
        <section className="mt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Credit packages</h2>
              <p className="mt-2 text-sm text-slate-400">
                Administrator controlled bundles. Credits are added after payment verification.
              </p>
            </div>
            <Link href="/wallet" className="btn-secondary btn-sm">
              <Wallet className="h-4 w-4" />
              Open wallet
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packages.slice(0, 4).map((pkg) => {
              const Icon = pkg.currency === 'gems' ? Gem : Coins;
              return (
                <div
                  key={pkg.id}
                  className={`card relative overflow-hidden p-5 ${
                    pkg.description === 'Best value' ? 'border-brand-500/40' : ''
                  }`}
                >
                  {pkg.description ? (
                    <span className="badge-info absolute right-4 top-4">{pkg.description}</span>
                  ) : null}
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 ${
                      pkg.currency === 'gems'
                        ? 'bg-gem-500/10 text-gem-300'
                        : 'bg-coin-500/10 text-coin-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 font-display text-2xl font-bold text-white">{pkg.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {formatCurrency(pkg.price, pkg.currency_code)}
                  </p>
                  <Link href="/wallet" className="btn-secondary btn-sm mt-4 w-full">
                    Buy {pkg.currency}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* How it works */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="card p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 font-display text-sm font-bold text-brand-300">
                {index + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-white">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Link href="/how-it-works" className="btn-ghost btn-sm">
            Read the full explanation
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-brand-600/20 via-ink-850/60 to-accent-600/20 px-6 py-10 text-center sm:px-10">
        <Sparkles className="mx-auto h-7 w-7 text-brand-300" />
        <h2 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
          Ready to analyse the next rounds?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
          Create an account, activate it with a one-time payment and start requesting analyses
          backed by real provider data.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Create Account
          </Link>
          <Link href="/live" className="btn-secondary px-6 py-3 text-base">
            View live feed
          </Link>
        </div>
      </section>
    </div>
  );
}
