import type { Metadata } from 'next';
import { PageHeader, StatCard, EmptyState } from '@/components/ui/primitives';
import { LocalTime } from '@/components/ui/LocalTime';
import { UserManager, type ManagedUser } from '@/components/admin/UserManager';
import { requireAdmin } from '@/lib/auth/session';
import { listUsers } from '@/lib/users/user-service';
import { walletsCollection } from '@/lib/storage/collections';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Admin Users' };

export default async function AdminUsersAdminPage() {
  const { user } = await requireAdmin();
  const [users, wallets] = await Promise.all([listUsers(), walletsCollection.read()]);

  const admins = users.filter((item) => item.role === 'admin');
  const staff: ManagedUser[] = admins.map((item) => {
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

  const candidates: ManagedUser[] = users
    .filter((item) => item.role !== 'admin')
    .slice(0, 40)
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
        title="Admin users"
        subtitle="Grant or revoke administrator access. You cannot remove your own privileges."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Administrators" value={admins.length} tone="info" />
        <StatCard
          label="Signed in recently"
          value={admins.filter((item) => item.last_login).length}
          tone="success"
        />
        <StatCard label="Standard users" value={users.length - admins.length} />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Current administrators
        </h2>
        {staff.length === 0 ? (
          <EmptyState title="No administrators" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {staff.map((admin) => (
              <li key={admin.id} className="card p-4">
                <p className="text-sm font-semibold text-white">
                  {admin.full_name}
                  {admin.id === user.id ? <span className="badge-info ml-2">you</span> : null}
                </p>
                <p className="text-[11px] text-slate-500">{admin.email}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Last login:{' '}
                  {admin.last_login ? (
                    <LocalTime iso={admin.last_login} mode="datetime" />
                  ) : (
                    'never'
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">
          Grant administrator access
        </h2>
        <UserManager users={candidates} currentUserId={user.id} />
      </section>
    </div>
  );
}
