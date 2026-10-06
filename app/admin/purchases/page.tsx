import type { Metadata } from 'next';
import { PageHeader, StatCard } from '@/components/ui/primitives';
import { ReviewTable, type ReviewRow } from '@/components/admin/ReviewTable';
import { requireAdmin } from '@/lib/auth/session';
import { listPurchases } from '@/lib/payments/purchase-service';
import { listUsers } from '@/lib/users/user-service';
import { formatCurrency } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Credit Purchases' };

export default async function AdminPurchasesPage() {
  await requireAdmin();

  const [purchases, users] = await Promise.all([listPurchases(), listUsers()]);

  const rows: ReviewRow[] = purchases.map((purchase) => {
    const owner = users.find((user) => user.id === purchase.user_id);
    return {
      id: purchase.id,
      user: {
        id: purchase.user_id,
        full_name: owner?.full_name ?? 'Deleted user',
        email: owner?.email ?? '—',
        username: owner?.username ?? '—',
      },
      amount: purchase.amount,
      currency_code: purchase.currency_code,
      reference: purchase.reference,
      status: purchase.status,
      created_at: purchase.created_at,
      reviewed_at: purchase.reviewed_at,
      admin_note: purchase.admin_note,
      has_receipt: Boolean(purchase.receipt_file),
      package_name: purchase.package_name,
      credits: purchase.credits,
      currency: purchase.currency,
    };
  });

  const pending = rows.filter((row) => row.status === 'pending');
  const reviewed = rows.filter((row) => row.status !== 'pending');

  return (
    <div>
      <PageHeader
        title="Credit purchases"
        subtitle="Credits are added to the wallet only when you approve a purchase. Uploading a receipt never grants credits."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={pending.length} tone="warning" />
        <StatCard
          label="Credits granted"
          value={rows
            .filter((row) => row.status === 'approved')
            .reduce((total, row) => total + (row.credits ?? 0), 0)
            .toLocaleString()}
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
          kind="purchase"
          rows={pending}
          emptyTitle="No pending purchases"
          emptyMessage="Credit purchase submissions appear here for review."
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Reviewed history
        </h2>
        <ReviewTable
          kind="purchase"
          rows={reviewed}
          emptyTitle="Nothing reviewed yet"
          emptyMessage="Approved and rejected purchases will be listed here."
        />
      </section>
    </div>
  );
}
