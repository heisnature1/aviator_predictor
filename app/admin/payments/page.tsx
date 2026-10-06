import type { Metadata } from 'next';
import { PageHeader, StatCard } from '@/components/ui/primitives';
import { ReviewTable, type ReviewRow } from '@/components/admin/ReviewTable';
import { requireAdmin } from '@/lib/auth/session';
import { listPayments } from '@/lib/payments/payment-service';
import { listUsers } from '@/lib/users/user-service';
import { formatCurrency } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Payments' };

export default async function AdminPaymentsPage() {
  await requireAdmin();

  const [payments, users] = await Promise.all([listPayments(), listUsers()]);

  const rows: ReviewRow[] = payments.map((payment) => {
    const owner = users.find((user) => user.id === payment.user_id);
    return {
      id: payment.id,
      user: {
        id: payment.user_id,
        full_name: owner?.full_name ?? 'Deleted user',
        email: owner?.email ?? '—',
        username: owner?.username ?? '—',
      },
      amount: payment.amount,
      currency_code: payment.currency_code,
      reference: payment.reference,
      status: payment.status,
      created_at: payment.created_at,
      reviewed_at: payment.reviewed_at,
      admin_note: payment.admin_note,
      has_receipt: Boolean(payment.receipt_file),
    };
  });

  const pending = rows.filter((row) => row.status === 'pending');
  const reviewed = rows.filter((row) => row.status !== 'pending');

  return (
    <div>
      <PageHeader
        title="Activation payments"
        subtitle="Approving activates the account and credits the configured activation bonus. Rejecting records your reason and notifies the user."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={pending.length} tone="warning" />
        <StatCard
          label="Approved"
          value={reviewed.filter((row) => row.status === 'approved').length}
          tone="success"
        />
        <StatCard
          label="Approved value"
          value={formatCurrency(
            rows
              .filter((row) => row.status === 'approved')
              .reduce((total, row) => total + row.amount, 0),
            rows[0]?.currency_code ?? 'GHS',
          )}
        />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Pending verification
        </h2>
        <ReviewTable
          kind="payment"
          rows={pending}
          emptyTitle="No pending activation payments"
          emptyMessage="New submissions appear here as soon as a user uploads a receipt."
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Reviewed history
        </h2>
        <ReviewTable
          kind="payment"
          rows={reviewed}
          emptyTitle="Nothing reviewed yet"
          emptyMessage="Approved and rejected payments will be listed here."
        />
      </section>
    </div>
  );
}
