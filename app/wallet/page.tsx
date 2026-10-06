import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { WalletCard } from '@/components/WalletCard';
import { PurchaseFlow } from '@/components/PurchaseFlow';
import { requireUser } from '@/lib/auth/session';
import { getBalances, listTransactions, TRANSACTION_TYPE_LABELS } from '@/lib/wallet/wallet-service';
import { listPackages } from '@/lib/packages/package-service';
import { getPaymentSettings, getSystemSettings } from '@/lib/settings/settings-service';
import { listPurchases } from '@/lib/payments/purchase-service';
import { formatCurrency } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Wallet' };

export default async function WalletPage() {
  const { user } = await requireUser();

  const [balance, transactions, packages, paymentSettings, systemSettings, purchases] =
    await Promise.all([
      getBalances(user.id),
      listTransactions(user.id, 50),
      listPackages(),
      getPaymentSettings(),
      getSystemSettings(),
      listPurchases({ userId: user.id }),
    ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Wallet"
        subtitle="Credits, purchases and the full ledger of every balance change."
        actions={
          <Link href="/predictions" className="btn-primary btn-sm">
            Make Prediction
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <WalletCard
            gems={balance.gems}
            coins={balance.coins}
            lowBalanceThreshold={systemSettings.low_balance_threshold}
            showActions={false}
          />

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white">Credit usage</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Cost per analysis</dt>
                <dd className="font-semibold text-white">
                  {systemSettings.prediction_cost_gems} gems
                  {systemSettings.prediction_cost_coins > 0
                    ? ` + ${systemSettings.prediction_cost_coins} coins`
                    : ''}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Analyses available</dt>
                <dd className="font-semibold text-white">
                  {systemSettings.prediction_cost_gems > 0
                    ? Math.floor(balance.gems / systemSettings.prediction_cost_gems)
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Low balance alert</dt>
                <dd className="font-semibold text-white">
                  {systemSettings.low_balance_threshold} gems
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
              Buy credits
            </h2>
            <PurchaseFlow
              packages={packages}
              settings={paymentSettings}
              accountActive={user.account_status === 'active'}
            />
          </section>
        </div>
      </div>

      <section className="mt-6 card overflow-hidden">
        <header className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Transaction history</h2>
          <p className="text-[11px] text-slate-500">
            Every balance change is recorded with the balance before and after.
          </p>
        </header>
        {transactions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No transactions yet"
              message="Purchases, activation bonuses and prediction charges appear here."
            />
          </div>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th className="hidden sm:table-cell">Balance</th>
                  <th className="hidden md:table-cell">Reference</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                            transaction.amount > 0
                              ? 'bg-success-500/10 text-success-400'
                              : 'bg-danger-500/10 text-danger-400'
                          }`}
                        >
                          {transaction.amount > 0 ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span>
                          <span className="block text-xs font-medium text-white">
                            {TRANSACTION_TYPE_LABELS[transaction.type]}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {transaction.description}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td
                      className={`font-semibold tabular ${
                        transaction.amount > 0 ? 'text-success-400' : 'text-danger-400'
                      }`}
                    >
                      {transaction.amount > 0 ? '+' : ''}
                      {transaction.amount.toLocaleString()} {transaction.currency}
                    </td>
                    <td className="hidden text-xs text-slate-400 tabular sm:table-cell">
                      {transaction.balance_before.toLocaleString()} →{' '}
                      {transaction.balance_after.toLocaleString()}
                    </td>
                    <td className="hidden font-mono text-[11px] text-slate-500 md:table-cell">
                      {transaction.reference.slice(0, 18)}
                    </td>
                    <td className="text-xs text-slate-400">
                      <LocalTime iso={transaction.created_at} mode="datetime" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 card overflow-hidden">
        <header className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Credit purchases</h2>
          <p className="text-[11px] text-slate-500">
            Submitted receipts and their verification status.
          </p>
        </header>
        {purchases.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No purchases yet" message="Buy a package above to get started." />
          </div>
        ) : (
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Amount</th>
                  <th className="hidden sm:table-cell">Credits</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="font-medium text-white">{purchase.package_name}</td>
                    <td className="text-slate-300">
                      {formatCurrency(purchase.amount, purchase.currency_code)}
                    </td>
                    <td className="hidden text-slate-300 tabular sm:table-cell">
                      {purchase.credits.toLocaleString()} {purchase.currency}
                    </td>
                    <td>
                      <StatusBadge status={purchase.status} />
                      {purchase.status === 'rejected' && purchase.admin_note ? (
                        <span className="block max-w-[220px] truncate text-[11px] text-slate-500">
                          {purchase.admin_note}
                        </span>
                      ) : null}
                    </td>
                    <td className="hidden text-xs text-slate-400 md:table-cell">
                      <LocalTime iso={purchase.created_at} mode="datetime" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
