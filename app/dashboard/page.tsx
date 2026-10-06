import type { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard, Gem, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { WalletCard } from '@/components/WalletCard';
import { PageHeader, StatCard, StatusBadge, EmptyState, Callout } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { requireUser } from '@/lib/auth/session';
import { getBalances, listTransactions } from '@/lib/wallet/wallet-service';
import { listUserPredictions } from '@/lib/predictions/prediction-history';
import { listNotifications, unreadCount } from '@/lib/notifications/notification-service';
import { listPayments } from '@/lib/payments/payment-service';
import { listPurchases } from '@/lib/payments/purchase-service';
import { getSystemSettings } from '@/lib/settings/settings-service';
import { TRANSACTION_TYPE_LABELS } from '@/lib/wallet/wallet-service';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const { user } = await requireUser();

  const [balance, transactions, predictions, notifications, unread, payments, purchases, settings] =
    await Promise.all([
      getBalances(user.id),
      listTransactions(user.id, 8),
      listUserPredictions(user.id, 5),
      listNotifications(user.id, 5),
      unreadCount(user.id),
      listPayments({ userId: user.id }),
      listPurchases({ userId: user.id }),
      getSystemSettings(),
    ]);

  const pendingPayment = payments.find((payment) => payment.status === 'pending') ?? null;
  const pendingPurchases = purchases.filter((purchase) => purchase.status === 'pending').length;

  const activity = [
    ...predictions.map((prediction) => ({
      id: prediction.id,
      kind: 'Prediction' as const,
      value:
        prediction.status === 'generated'
          ? `${prediction.estimated_min?.toFixed(2)}x – ${prediction.estimated_max?.toFixed(2)}x`
          : 'No estimate',
      detail: `${prediction.data_points} rounds analysed`,
      at: prediction.created_at,
      tone: prediction.status === 'generated' ? 'text-gem-300' : 'text-slate-400',
    })),
    ...transactions.map((transaction) => ({
      id: transaction.id,
      kind: TRANSACTION_TYPE_LABELS[transaction.type],
      value: `${transaction.amount > 0 ? '+' : ''}${transaction.amount.toLocaleString()} ${
        transaction.currency
      }`,
      detail: transaction.description,
      at: transaction.created_at,
      tone: transaction.amount > 0 ? 'text-success-400' : 'text-danger-400',
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title={`Welcome, ${user.full_name.split(' ')[0]}`}
        subtitle="Your account, wallet and recent activity at a glance."
        actions={
          <>
            <Link href="/wallet" className="btn-secondary btn-sm">
              <Wallet className="h-4 w-4" />
              Wallet
            </Link>
            <Link href="/predictions" className="btn-primary btn-sm">
              <Sparkles className="h-4 w-4" />
              Make Prediction
            </Link>
          </>
        }
      />

      {user.account_status !== 'active' ? (
        <div className="mb-6">
          <Callout
            tone={user.account_status === 'pending' ? 'warning' : 'danger'}
            title={
              user.account_status === 'pending'
                ? 'Account pending activation'
                : user.account_status === 'rejected'
                  ? 'Account rejected'
                  : 'Account suspended'
            }
            icon={<CreditCard className="h-4 w-4" />}
          >
            {user.account_status === 'pending'
              ? pendingPayment
                ? 'We have your payment and an administrator is reviewing it now.'
                : 'Complete the activation payment and upload your receipt to unlock predictions.'
              : user.status_note || 'Contact support for assistance.'}
            {user.account_status === 'pending' && !pendingPayment ? (
              <span className="ml-1">
                <Link href="/payments" className="font-semibold underline underline-offset-2">
                  View payment instructions
                </Link>
              </span>
            ) : null}
          </Callout>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Account"
          value={<StatusBadge status={user.account_status} />}
          hint={`@${user.username}`}
        />
        <StatCard
          label="Gems"
          value={balance.gems.toLocaleString()}
          hint={`${settings.prediction_cost_gems} gems per analysis`}
          tone="info"
          icon={<Gem className="h-4 w-4" />}
        />
        <StatCard
          label="Coins"
          value={balance.coins.toLocaleString()}
          hint="Secondary credit"
          tone="warning"
        />
        <StatCard
          label="Analyses"
          value={predictions.length}
          hint={pendingPurchases ? `${pendingPurchases} purchase(s) in review` : 'All time'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <WalletCard
            gems={balance.gems}
            coins={balance.coins}
            lowBalanceThreshold={settings.low_balance_threshold}
          />
        </div>

        <div className="space-y-5 lg:col-span-2">
          <section className="card overflow-hidden">
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Recent activity</h2>
              <Link href="/wallet" className="text-xs text-slate-400 hover:text-white">
                View all transactions
              </Link>
            </header>
            {activity.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No activity yet"
                  message="Request your first analysis or add credits to get started."
                />
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{item.kind}</p>
                      <p className="truncate text-[11px] text-slate-500">{item.detail}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold tabular ${item.tone}`}>{item.value}</p>
                      <LocalTime iso={item.at} mode="relative" className="text-[11px] text-slate-500" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Notifications</h2>
              <Link href="/notifications" className="text-xs text-slate-400 hover:text-white">
                {unread > 0 ? `${unread} unread` : 'View all'}
              </Link>
            </header>
            {notifications.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No notifications" message="Important account updates appear here." />
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {notifications.map((notification) => (
                  <li key={notification.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">
                          {notification.read ? null : (
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-400 align-middle" />
                          )}
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">{notification.message}</p>
                      </div>
                      <LocalTime
                        iso={notification.created_at}
                        mode="relative"
                        className="shrink-0 text-[11px] text-slate-500"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
