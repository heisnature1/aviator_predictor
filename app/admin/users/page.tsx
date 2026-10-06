import type { Metadata } from 'next';
import { PageHeader, StatCard } from '@/components/ui/primitives';
import { UserManager, type ManagedUser } from '@/components/admin/UserManager';
import { requireAdmin } from '@/lib/auth/session';
import { listUsers } from '@/lib/users/user-service';
import { walletsCollection } from '@/lib/storage/collections';
import { sortBy } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Users' };

export default async function AdminUsersPage() {
  const { user } = await requireAdmin();
  const [users, wallets] = await Promise.all([listUsers(), walletsCollection.read()]);

  const managed: ManagedUser[] = sortBy(users, (item) => item.created_at)
    .reverse()
    .map((item) => {
      const wallet = wallets.find((entry) => entry.user_id === item.id);
      return {
        id: item.id,
        full_name: item.full_name,
        username: item.username,
        email: item.email,
        phone: item.phone,
        role: item.role,
        account_status: item.account_status,
        created_at: item.created_at,
        last_login: item.last_login,
        gems: wallet?.gems ?? 0,
        coins: wallet?.coins ?? 0,
      };
    });

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Search, filter, activate, suspend, adjust wallets and manage roles."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total users" value={managed.length} />
        <StatCard
          label="Active"
          value={managed.filter((item) => item.account_status === 'active').length}
          tone="success"
        />
        <StatCard
          label="Pending"
          value={managed.filter((item) => item.account_status === 'pending').length}
          tone="warning"
        />
        <StatCard
          label="Suspended / rejected"
          value={
            managed.filter(
              (item) => item.account_status === 'suspended' || item.account_status === 'rejected',
            ).length
          }
          tone="danger"
        />
      </div>

      <UserManager users={managed} currentUserId={user.id} />
    </div>
  );
}
