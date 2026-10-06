import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { requireAdmin } from '@/lib/auth/session';
import { walletSummary, listAllTransactions } from '@/lib/wallet/wallet-service';
import { listUsers } from '@/lib/users/user-service';
import { listPackages } from '@/lib/packages/package-service';
import { formatCurrency, sortBy } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Credit Overview' };

export default async function AdminCreditOverviewPage() {
  await requireAdmin();

  const [summary, transactions, users, packages] = await Promise.all([
    walletSummary(),
    listAllTransactions(400),
    listUsers(),
    listPackages({ includeInactive: true }),
  ]);

  const topHolders = sortBy(summary.wallets, (wallet) => wallet.gems)
    .reverse()
    .slice(0, 8)
    .map((wallet) => ({
      wallet,
      user: users.find((item) => item.id === wallet.user_id),
    }));

  const byType = transactions.reduce<Record<string, { count: number; gems: number; coins: number }>>(
    (accumulator, transaction) => {
      const entry = accumulator[transaction.type] ?? { count: 0, gems: 0, coins: 0 };
      entry.count += 1;
      if (transaction.currency === 'gems') entry.gems += transaction.amount;
      else entry.coins += transaction.amount;
      accumulator[transaction.type] = entry;
      return accumulator;
    },
    {},
  );

  return (
    <div>
      <PageHeader
        title="Credit overview"
        subtitle="Issued credits, top holders and movement by transaction type."
        actions={
          <Link href="/admin/packages" className="btn-secondary btn-sm">
            Manage packages
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gems in circulation" value={summary.gemsInCirculation.toLocaleString()} tone="info" />
        <StatCard label="Coins in circulation" value={summary.coinsInCirculation.toLocaleString()} tone="warning" />
        <StatCard label="Credits sold" value={summary.creditsPurchased.toLocaleString()} tone="success" />
        <StatCard label="Wallet holders" value={summary.wallets.length} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <header className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Top gem holders</h2>
          </header>
          {topHolders.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No wallets yet" />
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {topHolders.map(({ wallet, user }) => (
                <li key={wallet.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{user?.full_name ?? 'Deleted user'}</p>
                    <p className="truncate text-[11px] text-slate-500">{user?.email ?? wallet.user_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular text-gem-300">
                      {wallet.gems.toLocaleString()} gems
                    </p>
                    <p className="text-[11px] tabular text-coin-300">
                      {wallet.coins.toLocaleString()} coins
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Movement by type</h2>
          </header>
          <div className="table-wrap border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Transactions</th>
                  <th>Gems</th>
                  <th>Coins</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byType).map(([type, entry]) => (
                  <tr key={type}>
                    <td className="text-xs text-white">{type.replace(/_/g, ' ')}</td>
                    <td className="tabular text-xs text-slate-300">{entry.count}</td>
                    <td
                      className={`tabular text-xs ${
                        entry.gems >= 0 ? 'text-success-400' : 'text-danger-400'
                      }`}
                    >
                      {entry.gems > 0 ? '+' : ''}
                      {entry.gems.toLocaleString()}
                    </td>
                    <td
                      className={`tabular text-xs ${
                        entry.coins >= 0 ? 'text-success-400' : 'text-danger-400'
                      }`}
                    >
                      {entry.coins > 0 ? '+' : ''}
                      {entry.coins.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-6 card overflow-hidden">
        <header className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Package catalogue value</h2>
        </header>
        <div className="table-wrap border-0">
          <table className="table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Credits</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td className="text-xs text-white">{pkg.name}</td>
                  <td className="tabular text-xs text-slate-300">
                    {pkg.credits.toLocaleString()} {pkg.currency}
                  </td>
                  <td className="tabular text-xs text-slate-300">
                    {formatCurrency(pkg.price, pkg.currency_code)}
                  </td>
                  <td>
                    <span className={pkg.active ? 'badge-success' : 'badge-muted'}>
                      {pkg.active ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-[11px] text-slate-500">
          Ledger last touched{' '}
          {transactions[0] ? <LocalTime iso={transactions[0].created_at} mode="datetime" /> : '—'}
        </p>
      </section>
    </div>
  );
}
