import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  BadgeDollarSign,
  CreditCard,
  Gem,
  HardDrive,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader, StatCard, EmptyState, Callout } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { requireAdmin } from '@/lib/auth/session';
import { dashboardStats, recentActivity } from '@/lib/admin/admin-service';
import { AUDIT_ACTION_LABELS } from '@/lib/audit/audit-service';
import { listPayments } from '@/lib/payments/payment-service';
import { listPurchases } from '@/lib/payments/purchase-service';
import { listUsers, ACCOUNT_STATUS_LABELS } from '@/lib/users/user-service';
import { describeStorage } from '@/lib/storage/database';
import { getFeedDiagnostics } from '@/lib/aviator/live-feed';
import { formatCurrency } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admin Dashboard' };

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();

  const [stats, activity, payments, purchases, users, storage, feed] = await Promise.all([
    dashboardStats(),
    recentActivity(10),
    listPayments({ status: 'pending' }),
    listPurchases({ status: 'pending' }),
    listUsers(),
    Promise.resolve(describeStorage()),
    Promise.resolve(getFeedDiagnostics()),
  ]);

  const pendingAccounts = users.filter((item) => item.account_status === 'pending');

  return (
    <div>
      <PageHeader
        title="Administration"
        subtitle={`Signed in as ${user.full_name}. Every action you take is written to the audit log.`}
        actions={
          <Link href="/admin/settings/payments" className="btn-secondary btn-sm">
            Payment settings
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers} hint={`${stats.activeUsers} active`} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Pending accounts"
          value={stats.pendingAccounts}
          hint="Awaiting activation review"
          tone="warning"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Pending payments"
          value={stats.pendingPayments + stats.pendingPurchases}
          hint={`${stats.pendingPayments} activation · ${stats.pendingPurchases} credit`}
          tone="danger"
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatCard
          label="Prediction requests"
          value={stats.predictionRequests}
          hint={`${stats.predictionsGenerated} produced an estimate`}
          tone="info"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label="Credits sold"
          value={stats.creditsSold.toLocaleString()}
          hint={`${stats.gemsInCirculation.toLocaleString()} gems in circulation`}
          icon={<Gem className="h-4 w-4" />}
        />
        <StatCard
          label="Approved revenue"
          value={formatCurrency(stats.approvedRevenue)}
          hint="Activation + credit purchases"
          tone="success"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard label="Coins in circulation" value={stats.coinsInCirculation.toLocaleString()} />
        <StatCard
          label="Live feed"
          value={feed.configured ? feed.provider : 'Not configured'}
          hint={`mode: ${feed.mode}`}
          tone={feed.configured ? 'success' : 'warning'}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {storage.warning ? (
        <div className="mt-6">
          <Callout tone="warning" title="Storage durability" icon={<HardDrive className="h-4 w-4" />}>
            {storage.warning} Current mode: <strong>{storage.mode}</strong> ({storage.label}).
          </Callout>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Awaiting review</h2>
            <Link href="/admin/payments" className="text-xs text-slate-400 hover:text-white">
              Open payments
            </Link>
          </header>

          {payments.length === 0 && purchases.length === 0 && pendingAccounts.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Queue is clear" message="No payments, purchases or accounts waiting." />
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {pendingAccounts.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{item.full_name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {ACCOUNT_STATUS_LABELS[item.account_status]} · {item.email}
                    </p>
                  </div>
                  <Link href="/admin/pending-accounts" className="btn-secondary btn-sm">
                    Review
                  </Link>
                </li>
              ))}
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      Activation · {formatCurrency(payment.amount, payment.currency_code)}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      Ref {payment.reference} · <LocalTime iso={payment.created_at} mode="relative" />
                    </p>
                  </div>
                  <Link href="/admin/payments" className="btn-secondary btn-sm">
                    Review
                  </Link>
                </li>
              ))}
              {purchases.map((purchase) => (
                <li key={purchase.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {purchase.package_name} · {formatCurrency(purchase.amount, purchase.currency_code)}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {purchase.credits.toLocaleString()} {purchase.currency} ·{' '}
                      <LocalTime iso={purchase.created_at} mode="relative" />
                    </p>
                  </div>
                  <Link href="/admin/purchases" className="btn-secondary btn-sm">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Recent activity</h2>
            <Link href="/admin/audit" className="text-xs text-slate-400 hover:text-white">
              Full log
            </Link>
          </header>
          {activity.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No activity yet" />
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {activity.map((entry) => (
                <li key={entry.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {entry.target_label ?? entry.target_user ?? '—'}
                        {entry.new_value ? ` · ${entry.new_value}` : ''}
                      </p>
                    </div>
                    <LocalTime iso={entry.timestamp} mode="relative" className="shrink-0 text-[11px] text-slate-500" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <BadgeDollarSign className="h-4 w-4 text-slate-400" />
          Quick links
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/admin/payments', label: 'Verify activation payments' },
            { href: '/admin/purchases', label: 'Approve credit purchases' },
            { href: '/admin/packages', label: 'Manage credit packages' },
            { href: '/admin/settings/payments', label: 'Update payment details' },
            { href: '/admin/users', label: 'Manage users & wallets' },
            { href: '/admin/predictions', label: 'Review predictions' },
            { href: '/admin/audit', label: 'Inspect audit log' },
            { href: '/admin/admins', label: 'Manage administrators' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
