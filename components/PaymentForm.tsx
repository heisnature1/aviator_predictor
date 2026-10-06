'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Copy, Loader2, Send } from 'lucide-react';
import { ReceiptUpload, type ReceiptFileState } from '@/components/ReceiptUpload';
import { useToast } from '@/components/ui/Toast';
import { Callout } from '@/components/ui/primitives';
import type { PaymentSettings } from '@/types';

/**
 * Activation payment instructions + receipt submission.
 *
 * All amounts, numbers and instructions come from server settings
 * (data/settings/settings.json) — nothing is hard-coded here.
 */
export function PaymentForm({
  settings,
  reference,
  status,
  existingPayment,
}: {
  settings: PaymentSettings;
  reference: string;
  status: string | null;
  existingPayment: { status: string; reference: string; admin_note: string | null } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(String(settings.activation_fee));
  const [paymentMethod, setPaymentMethod] = useState(settings.payment_method);
  const [txReference, setTxReference] = useState('');
  const [receipt, setReceipt] = useState<ReceiptFileState>({ file: null, error: null });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const locked = Boolean(existingPayment && existingPayment.status === 'pending') || status === 'active';

  function copy(value: string) {
    void navigator.clipboard?.writeText(value);
    toast.info('Copied', value);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!receipt.file) {
      setFieldErrors({ receipt: 'Attach your payment receipt before submitting.' });
      return;
    }

    const form = new FormData();
    form.set('amount', amount);
    form.set('payment_method', paymentMethod);
    form.set('reference', txReference);
    form.set('receipt', receipt.file);

    setSubmitting(true);
    try {
      // Multipart upload — handled by the shared api helper (adds CSRF).
      const { post } = await import('@/lib/client/api');
      await post('/api/payments/activation', form);
      toast.success('Payment submitted', 'An administrator will verify your receipt shortly.');
      setReceipt({ file: null, error: null });
      setTxReference('');
      router.refresh();
    } catch (caught) {
      const apiError = caught as { message?: string; fields?: Record<string, string> };
      setError(apiError.message ?? 'The payment could not be submitted.');
      if (apiError.fields) setFieldErrors(apiError.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className="card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Account activation
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Send the exact amount, then upload the confirmation message you receive.
        </p>

        <dl className="mt-4 space-y-3">
          <InstructionRow
            label="Amount"
            value={`${settings.currency_code} ${settings.activation_fee}`}
            onCopy={() => copy(String(settings.activation_fee))}
            highlight
          />
          <InstructionRow
            label="Payment method"
            value={settings.payment_method}
            onCopy={() => copy(settings.payment_method)}
          />
          <InstructionRow
            label="Payment number"
            value={settings.payment_number}
            onCopy={() => copy(settings.payment_number)}
          />
          <InstructionRow
            label="Account name"
            value={settings.account_name}
            onCopy={() => copy(settings.account_name)}
          />
          <InstructionRow
            label="Your reference"
            value={reference}
            onCopy={() => copy(reference)}
          />
        </dl>

        {settings.payment_instructions ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs leading-relaxed text-slate-400">
            {settings.payment_instructions}
          </div>
        ) : null}

        {settings.support_contact ? (
          <p className="mt-3 text-xs text-slate-500">
            Need help? Contact <span className="text-slate-300">{settings.support_contact}</span>
          </p>
        ) : null}
      </section>

      <section className="card p-5 lg:col-span-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Submit payment receipt
        </h2>

        {status === 'active' ? (
          <Callout tone="success" title="Your account is active" icon={<CheckCircle2 className="h-4 w-4" />}>
            No further action is needed. Credits were already added to your wallet.
          </Callout>
        ) : existingPayment?.status === 'pending' ? (
          <div className="mt-3 space-y-3">
            <Callout tone="warning" title="Payment awaiting verification">
              We received your payment (<strong>{existingPayment.reference}</strong>). An
              administrator reviews every receipt manually — you will be notified as soon as it is
              approved.
            </Callout>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => router.refresh()}
            >
              Refresh status
            </button>
          </div>
        ) : existingPayment?.status === 'rejected' ? (
          <div className="mt-3 space-y-3">
            <Callout tone="danger" title="Previous payment was rejected">
              {existingPayment.admin_note ?? 'No reason was provided.'} You can submit a new payment
              below.
            </Callout>
          </div>
        ) : null}

        {!locked ? (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="amount">
                  Amount ({settings.currency_code})
                </label>
                <input
                  id="amount"
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
                <label className="label" htmlFor="payment_method">
                  Payment method
                </label>
                <input
                  id="payment_method"
                  className="input"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  required
                />
                {fieldErrors.payment_method ? (
                  <p className="mt-1.5 text-xs text-danger-400">{fieldErrors.payment_method}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="reference">
                Transaction / reference number
              </label>
              <input
                id="reference"
                className="input"
                placeholder="e.g. ACX82K91"
                value={txReference}
                onChange={(event) => setTxReference(event.target.value)}
                required
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Copy the reference from the confirmation message you received.
              </p>
              {fieldErrors.reference ? (
                <p className="mt-1 text-xs text-danger-400">{fieldErrors.reference}</p>
              ) : null}
            </div>

            <div>
              <ReceiptUpload value={receipt} onChange={setReceipt} disabled={submitting} />
              {fieldErrors.receipt ? (
                <p className="mt-1.5 text-xs text-danger-400">{fieldErrors.receipt}</p>
              ) : null}
            </div>

            {error ? (
              <p className="rounded-xl border border-danger-500/25 bg-danger-500/10 px-3 py-2.5 text-xs text-danger-300">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit payment for review
                </>
              )}
            </button>

            <p className="text-[11px] leading-relaxed text-slate-500">
              Submitting a receipt does not activate your account automatically. Credits are never
              added until an administrator verifies the payment.
            </p>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function InstructionRow({
  label,
  value,
  onCopy,
  highlight = false,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
        <dd
          className={`truncate text-sm font-semibold ${
            highlight ? 'font-display text-xl text-brand-400' : 'text-white'
          }`}
        >
          {value}
        </dd>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
