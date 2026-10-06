import type { Metadata } from 'next';
import { PageHeader, StatCard } from '@/components/ui/primitives';
import { NotificationsList } from '@/components/NotificationsList';
import { requireUser } from '@/lib/auth/session';
import { listNotifications, unreadCount } from '@/lib/notifications/notification-service';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const { user } = await requireUser();
  const [notifications, unread] = await Promise.all([
    listNotifications(user.id, 60),
    unreadCount(user.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Notifications"
        subtitle="Payments, purchases, analyses and account updates — all in one place."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={notifications.length} />
        <StatCard label="Unread" value={unread} tone={unread > 0 ? 'warning' : 'default'} />
        <StatCard label="Latest" value={notifications[0]?.title ?? '—'} />
      </div>

      <NotificationsList notifications={notifications} unread={unread} />
    </div>
  );
}
