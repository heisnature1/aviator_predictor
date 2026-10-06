import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/AdminSidebar';
import { getCurrentUser } from '@/lib/auth/session';
import { paymentStats } from '@/lib/payments/payment-service';
import { purchaseStats } from '@/lib/payments/purchase-service';
import { userStats } from '@/lib/users/user-service';

/**
 * Admin area protection.
 *
 * Server-side role check on every request — hiding admin links in the UI is
 * cosmetic. Non-administrators are redirected before any admin data loads.
 * Every /api/admin/* route repeats this check independently.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentUser();
  if (!context) redirect('/login?next=/admin');
  if (context.user.role !== 'admin') redirect('/dashboard?denied=admin');
  if (context.user.account_status !== 'active') redirect('/dashboard?denied=inactive');

  const [payments, purchases, users] = await Promise.all([
    paymentStats(),
    purchaseStats(),
    userStats(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <AdminSidebar
          badges={{
            '/admin/payments': payments.pending,
            '/admin/purchases': purchases.pending,
            '/admin/pending-accounts': users.pending,
          }}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
