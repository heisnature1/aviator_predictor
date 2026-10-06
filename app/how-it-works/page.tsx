import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  CreditCard,
  Radio,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { Callout, PageHeader } from '@/components/ui/primitives';
import { getPaymentSettings, getSystemSettings } from '@/lib/settings/settings-service';
import { getFeedDiagnostics } from '@/lib/aviator/live-feed';
import { formatCurrency } from '@/lib/utils';

export const metadata: Metadata = { title: 'How It Works' };

export default async function HowItWorksPage() {
  const [paymentSettings, systemSettings, diagnostics] = await Promise.all([
    getPaymentSettings(),
    getSystemSettings(),
    Promise.resolve(getFeedDiagnostics()),
  ]);

  const steps = [
    {
      icon: UserPlus,
      title: '1. Create your account',
      body: 'Registration creates a pending account. Passwords are hashed with scrypt and never stored in plain text.',
    },
    {
      icon: CreditCard,
      title: '2. Complete the activation payment',
      body: `Send ${formatCurrency(
        paymentSettings.activation_fee,
        paymentSettings.currency_code,
      )} to the configured ${paymentSettings.payment_method} number, then upload your receipt. An administrator verifies every submission by hand — nothing is automatic.`,
    },
    {
      icon: Wallet,
      title: '3. Add credits',
      body: 'Choose a gem or coin bundle, pay, and upload your receipt. Credits land in your wallet only after approval.',
    },
    {
      icon: BarChart3,
      title: '4. Request an analysis',
      body: `Each request costs ${systemSettings.prediction_cost_gems} gems and is generated server-side from the live provider feed. Credits are only deducted when an estimate is actually produced.`,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        title="How it works"
        subtitle="A transparent walkthrough of the data, the money and the analysis — including what this platform deliberately does not do."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="card p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-400">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-sm font-semibold text-white">{step.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{step.body}</p>
            </div>
          );
        })}
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="font-display text-xl font-bold text-white">Where the data comes from</h2>
        <div className="card space-y-3 p-5 text-sm leading-relaxed text-slate-300">
          <p className="flex items-start gap-2.5">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
            <span>
              The live game panel reads exclusively from a configured Aviator data provider
              (<code className="rounded bg-black/30 px-1 text-xs">AVIATOR_PROVIDER_URL</code>).
              Currently configured provider:{' '}
              <strong className="text-white">{diagnostics.provider}</strong> (mode:{' '}
              {diagnostics.mode}).
            </span>
          </p>
          <p className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-coin-300" />
            <span>
              If no provider is configured, or the provider cannot be reached, the platform shows an
              explicit unavailable state. It does <strong className="text-white">not</strong>{" "}
              generate multipliers and present them as real results.
            </span>
          </p>
          <p className="flex items-start gap-2.5">
            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-gem-300" />
            <span>
              Predictions are produced by a descriptive statistics engine that reads the most recent
              rounds (minimum {systemSettings.min_data_points} data points) and reports an estimated
              reachable band with an explicit confidence level.
            </span>
          </p>
        </div>

        <Callout tone="warning" title="What we never claim" icon={<ShieldAlert className="h-4 w-4" />}>
          <ul className="ml-4 list-disc space-y-1">
            <li>We do not guarantee winnings, profit or any specific crash point.</li>
            <li>We do not claim 90% or 99% accuracy — no model can know a committed round seed.</li>
            <li>We do not fabricate historical rounds or simulate results as if they were real.</li>
            <li>We do not add credits or activate accounts without human review.</li>
          </ul>
        </Callout>

        <Callout tone="success" title="Payments, verified by people" icon={<ShieldCheck className="h-4 w-4" />}>
          Receipts are stored privately and only the account owner or an administrator can open
          them. Approval and rejection are recorded in the audit log with the administrator, the
          reason and the values before and after.
        </Callout>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/register" className="btn-primary">
          Create Account
        </Link>
        <Link href="/live" className="btn-secondary">
          View the live feed
        </Link>
      </div>
    </div>
  );
}
