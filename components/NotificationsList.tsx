'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { patch } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import { LocalTime } from '@/components/ui/LocalTime';
import { EmptyState } from '@/components/ui/primitives';
import type { Notification } from '@/types';

export function NotificationsList({
  notifications,
  unread,
}: {
  notifications: Notification[];
  unread: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [working, setWorking] = useState(false);

  async function markAll() {
    setWorking(true);
    try {
      await patch('/api/notifications');
      toast.success('All notifications marked as read');
      router.refresh();
    } catch (error) {
      toast.error('Could not update notifications', (error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function markOne(id: string) {
    try {
      await patch('/api/notifications', { id });
      router.refresh();
    } catch {
      /* silent — the list will stay unread */
    }
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">
            Notifications {unread > 0 ? <span className="text-slate-500">({unread} unread)</span> : null}
          </h2>
        </div>
        {unread > 0 ? (
          <button type="button" className="btn-secondary btn-sm" onClick={markAll} disabled={working}>
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No notifications" message="Account updates will show up here." />
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`flex items-start justify-between gap-4 px-5 py-3.5 transition ${
                notification.read ? '' : 'bg-brand-500/[0.04]'
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  {notification.read ? null : (
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                  )}
                  {notification.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{notification.message}</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <LocalTime iso={notification.created_at} mode="relative" className="text-[11px] text-slate-500" />
                  {notification.link ? (
                    <Link href={notification.link} className="text-[11px] text-brand-400 hover:text-brand-300">
                      Open
                    </Link>
                  ) : null}
                  {!notification.read ? (
                    <button
                      type="button"
                      onClick={() => markOne(notification.id)}
                      className="text-[11px] text-slate-500 hover:text-slate-300"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              </div>
              <span className="badge-muted shrink-0">{notification.kind.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
