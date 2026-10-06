import type { Metadata } from 'next';
import { CreditCard } from 'lucide-react';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { PaymentForm } from '@/components/PaymentForm';
import { requireUser } from '@/lib/auth/session';
import { getPaymentSettings, getSystemSettings } from '@/lib/settings/settings-service';
import { listPayments } from '@/lib/payments/payment-service';
import { formatCurrency } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Activation Payment' };

export default async function PaymentsPage() {
  const { user } = await requireUser();
  const [settings, systemSettings, payments] = await Promise.all([
    getPaymentSettings(),
    getSystemSettings(),
    listPayments({ userId: user.id }),
  ]);

  // Stable per-account reference quoted to the user on the transfer.
  const reference = `ACT-${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;
  const latest = payments[0] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Account activation"
        subtitle="One-time activation payment. Your account stays pending until an administrator verifies the receipt."
      />

      <PaymentForm
        settings={settings}
        reference={reference}
        status={user.account_status}
        existingPayment={
          latest
            ? { status: latest.status, reference: latest.reference, admin_note: latest.admin_note }
            : null
        }
      />

      <section className="mt-6 card overflow-hidden">
        <header className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <CreditCard className="h-4 w-4 text-slate-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Payment history</h2>
            <p className="text-[11px] text-slate-500">
              Activation payments you have submitted and their review outcome.
            </p>
          </div>
        </header>

        {payments.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No payments submitted"
              message={`Send ${formatCurrency(
                settings.activation_fee,
                settings.currency_code,
              )} and upload your receipt above.`}
            />
          </div>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th className="hidden sm:table-cell">Method</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Submitted</th>
                  <th className="hidden lg:table-cell">Note</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-semibold text-white">
                      {formatCurrency(payment.amount, payment.currency_code)}
                    </td>
                    <td className="font-mono text-xs text-slate-300">{payment.reference}</td>
                    <td className="hidden text-slate-400 sm:table-cell">{payment.payment_method}</td>
                    <td>
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="hidden text-xs text-slate-400 md:table-cell">
                      <LocalTime iso={payment.created_at} mode="datetime" />
                    </td>
                    <td className="hidden max-w-[240px] truncate text-xs text-slate-500 lg:table-cell">
                      {payment.admin_note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {systemSettings.activation_bonus_gems > 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          Approved accounts receive {systemSettings.activation_bonus_gems} gems
          {systemSettings.activation_bonus_coins > 0
            ? ` and ${systemSettings.activation_bonus_coins} coins`
            : ''}{' '}
          as a starting balance.
        </p>
      ) : null}
    </div>
  );
}
