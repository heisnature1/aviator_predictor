import type { Metadata } from 'next';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { ReviewTable, type ReviewRow } from '@/components/admin/ReviewTable';
import { requireAdmin } from '@/lib/auth/session';
import { listUsers } from '@/lib/users/user-service';
import { listPayments } from '@/lib/payments/payment-service';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pending Accounts' };

export default async function PendingAccountsPage() {
  await requireAdmin();

  const [users, payments] = await Promise.all([listUsers(), listPayments()]);
  const pendingUsers = users.filter((item) => item.account_status === 'pending');

  const rows: ReviewRow[] = pendingUsers.flatMap((item) => {
    const userPayments = payments.filter(
      (payment) => payment.user_id === item.id && payment.type === 'account_activation',
    );

    if (userPayments.length === 0) {
      return [
        {
          id: `no-payment-${item.id}`,
          user: { id: item.id, full_name: item.full_name, email: item.email, username: item.username },
          amount: 0,
          currency_code: '—',
          reference: 'No payment yet',
          status: 'pending' as const,
          created_at: item.created_at,
          reviewed_at: null,
          admin_note: 'This user has registered but has not submitted an activation payment.',
          has_receipt: false,
        },
      ];
    }

    return userPayments.map((payment) => ({
      id: payment.id,
      user: { id: item.id, full_name: item.full_name, email: item.email, username: item.username },
      amount: payment.amount,
      currency_code: payment.currency_code,
      reference: payment.reference,
      status: payment.status,
      created_at: payment.created_at,
      reviewed_at: payment.reviewed_at,
      admin_note: payment.admin_note,
      has_receipt: Boolean(payment.receipt_file),
    }));
  });

  return (
    <div>
      <PageHeader
        title="Pending accounts"
        subtitle="Accounts waiting for activation. Approving the payment activates the account and credits the activation bonus."
      />

      {pendingUsers.length === 0 ? (
        <EmptyState
          title="No pending accounts"
          message="Every registered account has been reviewed."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {pendingUsers.slice(0, 6).map((item) => (
              <div key={item.id} className="card p-4">
                <p className="truncate text-sm font-semibold text-white">{item.full_name}</p>
                <p className="truncate text-[11px] text-slate-500">{item.email}</p>
                <div className="mt-2 flex items-center justify-between">
                  <StatusBadge status={item.account_status} />
                  <LocalTime iso={item.created_at} mode="relative" className="text-[11px] text-slate-500" />
                </div>
              </div>
            ))}
          </div>

          <ReviewTable
            kind="payment"
            rows={rows.filter((row) => !row.id.startsWith('no-payment-'))}
            emptyTitle="No activation payments to review"
            emptyMessage="These users registered but have not submitted a payment receipt yet."
          />
        </>
      )}
    </div>
  );
}
