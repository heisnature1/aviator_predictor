'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Coins, Gem, Loader2, Send, Wallet } from 'lucide-react';
import { post } from '@/lib/client/api';
import { ReceiptUpload, type ReceiptFileState } from '@/components/ReceiptUpload';
import { useToast } from '@/components/ui/Toast';
import { Callout } from '@/components/ui/primitives';
import { formatCurrency } from '@/lib/format';
import type { CreditPackage, PaymentSettings } from '@/types';

/**
 * Credit purchase flow.
 *
 * Package price and credit amount always come from the server-side package
 * record. Submitting only creates a `pending` purchase — credits are added by
 * an administrator in /admin/purchases.
 */
export function PurchaseFlow({
  packages,
  settings,
  accountActive,
}: {
  packages: CreditPackage[];
  settings: PaymentSettings;
  accountActive: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string>(packages[0]?.id ?? '');
  const selected = packages.find((item) => item.id === selectedId) ?? packages[0] ?? null;

  const [amount, setAmount] = useState(selected ? String(selected.price) : '');
  const [method, setMethod] = useState(settings.payment_method);
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<ReceiptFileState>({ file: null, error: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function selectPackage(pkg: CreditPackage) {
    setSelectedId(pkg.id);
    setAmount(String(pkg.price));
    setError(null);
    setFieldErrors({});
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!selected) {
      setError('Select a credit package first.');
      return;
    }
    if (!receipt.file) {
      setFieldErrors({ receipt: 'Attach your payment receipt before submitting.' });
      return;
    }

    const form = new FormData();
    form.set('package_id', selected.id);
    form.set('amount', amount);
    form.set('payment_method', method);
    form.set('reference', reference);
    form.set('receipt', receipt.file);

    setSubmitting(true);
    try {
      await post('/api/purchases', form);
      toast.success('Purchase submitted', 'Credits are added once an administrator verifies the payment.');
      setReceipt({ file: null, error: null });
      setReference('');
      router.refresh();
    } catch (caught) {
      const apiError = caught as { message?: string; fields?: Record<string, string> };
      setError(apiError.message ?? 'The purchase could not be submitted.');
      if (apiError.fields) setFieldErrors(apiError.fields);
      toast.error('Submission failed', apiError.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!accountActive) {
    return (
      <Callout tone="warning" title="Account activation required">
        Your account must be active before you can buy credits.{' '}
        <a href="/payments" className="font-semibold underline underline-offset-2">
          Complete activation
        </a>
        .
      </Callout>
    );
  }

  if (packages.length === 0) {
    return (
      <Callout tone="info" title="No packages available">
        The administrator has not published any credit packages yet.
      </Callout>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className="lg:col-span-3">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Choose a package
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((pkg) => {
            const active = selected?.id === pkg.id;
            const Icon = pkg.currency === 'gems' ? Gem : Coins;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => selectPackage(pkg)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-brand-500/50 bg-brand-500/10 shadow-glow-sm'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 ${
                    pkg.currency === 'gems' ? 'bg-gem-500/10 text-gem-300' : 'bg-coin-500/10 text-coin-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 font-display text-xl font-bold text-white">{pkg.name}</p>
                <p className="text-xs text-slate-400">
                  {formatCurrency(pkg.price, pkg.currency_code || settings.currency_code)}
                </p>
                {pkg.description ? (
                  <span className="badge-muted mt-2">{pkg.description}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
            Selected: <strong className="text-white">{selected.name}</strong> ·{' '}
            {formatCurrency(selected.price, selected.currency_code || settings.currency_code)} ·{' '}
            {selected.credits.toLocaleString()} {selected.currency} added after approval.
          </div>
        ) : null}
      </section>

      <section className="card p-5 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          <Wallet className="h-4 w-4" />
          Pay & upload receipt
        </h2>

        <dl className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
          <Row label="Amount" value={formatCurrency(selected?.price ?? 0, selected?.currency_code || settings.currency_code)} />
          <Row label="Method" value={settings.payment_method} />
          <Row label="Number" value={settings.payment_number} />
          <Row label="Name" value={settings.account_name} />
        </dl>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="purchase-amount">
              Amount paid
            </label>
            <input
              id="purchase-amount"
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            {fieldErrors.amount ? (
              <p className="mt-1.5 text-xs text-danger-400">{fieldErrors.amount}</p>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="purchase-method">
              Payment method
            </label>
            <input
              id="purchase-method"
              className="input"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="purchase-reference">
              Transaction reference
            </label>
            <input
              id="purchase-reference"
              className="input"
              placeholder="e.g. ACX82K91"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              required
            />
            {fieldErrors.reference ? (
              <p className="mt-1.5 text-xs text-danger-400">{fieldErrors.reference}</p>
            ) : null}
          </div>

          <ReceiptUpload value={receipt} onChange={setReceipt} disabled={submitting} />
          {fieldErrors.receipt ? (
            <p className="text-xs text-danger-400">{fieldErrors.receipt}</p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-danger-500/25 bg-danger-500/10 px-3 py-2.5 text-xs text-danger-300">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={submitting || !selected}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit purchase
              </>
            )}
          </button>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Credits are never added automatically. An administrator verifies your receipt first.
          </p>
        </form>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-semibold text-white">{value}</dd>
    </div>
  );
}
