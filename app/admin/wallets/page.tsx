import type { Metadata } from 'next';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { requireAdmin } from '@/lib/auth/session';
import { walletsCollection, transactionsCollection } from '@/lib/storage/collections';
import { listUsers } from '@/lib/users/user-service';
import { walletSummary, TRANSACTION_TYPE_LABELS } from '@/lib/wallet/wallet-service';
import { sortBy } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Wallets' };

export default async function AdminWalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const [wallets, transactions, users, summary] = await Promise.all([
    walletsCollection.read(),
    transactionsCollection.read(),
    listUsers(),
    walletSummary(),
  ]);

  const rows = sortBy(wallets, (wallet) => wallet.gems + wallet.coins)
    .reverse()
    .map((wallet) => ({
      wallet,
      user: users.find((item) => item.id === wallet.user_id),
    }));

  const ledger = sortBy(
    params.user ? transactions.filter((item) => item.user_id === params.user) : transactions,
    (item) => item.created_at,
  )
    .reverse()
    .slice(0, 150);

  return (
    <div>
      <PageHeader
        title="Wallets"
        subtitle="All balances and the full transaction ledger. Balances can only change through a recorded transaction."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Gems in circulation" value={summary.gemsInCirculation.toLocaleString()} tone="info" />
        <StatCard label="Coins in circulation" value={summary.coinsInCirculation.toLocaleString()} tone="warning" />
        <StatCard label="Credits sold" value={summary.creditsPurchased.toLocaleString()} tone="success" />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Balances
        </h2>
        {rows.length === 0 ? (
          <EmptyState title="No wallets yet" message="Wallets are created on first use." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Gems</th>
                  <th>Coins</th>
                  <th className="hidden md:table-cell">Updated</th>
                  <th className="text-right">Ledger</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ wallet, user }) => (
                  <tr key={wallet.user_id}>
                    <td>
                      <p className="text-xs font-medium text-white">{user?.full_name ?? 'Deleted user'}</p>
                      <p className="text-[11px] text-slate-500">{user?.email ?? wallet.user_id}</p>
                    </td>
                    <td className="font-semibold tabular text-gem-300">
                      {wallet.gems.toLocaleString()}
                    </td>
                    <td className="font-semibold tabular text-coin-300">
                      {wallet.coins.toLocaleString()}
                    </td>
                    <td className="hidden text-xs text-slate-400 md:table-cell">
                      <LocalTime iso={wallet.updated_at} mode="datetime" />
                    </td>
                    <td className="text-right">
                      <a href={`/admin/wallets?user=${wallet.user_id}`} className="btn-secondary btn-sm">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          {params.user ? 'Ledger for selected user' : 'Recent transactions'}
        </h2>
        {ledger.length === 0 ? (
          <EmptyState title="No transactions" message="Wallet activity will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th className="hidden sm:table-cell">Before → After</th>
                  <th className="hidden lg:table-cell">Description</th>
                  <th className="hidden md:table-cell">User</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((transaction) => {
                  const owner = users.find((item) => item.id === transaction.user_id);
                  return (
                    <tr key={transaction.id}>
                      <td className="text-xs text-white">
                        {TRANSACTION_TYPE_LABELS[transaction.type]}
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
                      <td className="hidden max-w-[260px] truncate text-xs text-slate-400 lg:table-cell">
                        {transaction.description}
                      </td>
                      <td className="hidden text-xs text-slate-400 md:table-cell">
                        {owner?.full_name ?? '—'}
                      </td>
                      <td className="text-xs text-slate-400">
                        <LocalTime iso={transaction.created_at} mode="datetime" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
