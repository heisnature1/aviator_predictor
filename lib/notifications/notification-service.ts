import { notificationsCollection } from '@/lib/storage/collections';
import { newId, nowIso } from '@/lib/utils';
import type { Notification, NotificationKind } from '@/types';

/**
 * In-app notifications.
 * Stored in data/notifications/notifications.json (200 per user, rolling).
 */

const MAX_PER_USER = 200;

export interface NotificationInput {
  user_id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  link?: string | null;
}

export async function notify(input: NotificationInput): Promise<Notification> {
  const entry: Notification = {
    id: newId('ntf'),
    user_id: input.user_id,
    kind: input.kind,
    title: input.title,
    message: input.message,
    read: false,
    link: input.link ?? null,
    created_at: nowIso(),
  };

  await notificationsCollection.mutate((entries) => {
    const forUser = entries.filter((item) => item.user_id === entry.user_id);
    const trimmed =
      forUser.length >= MAX_PER_USER
        ? forUser.slice(forUser.length - MAX_PER_USER + 1).map((item) => item.id)
        : [];
    const next = [...entries.filter((item) => !trimmed.includes(item.id)), entry];
    return next;
  });

  return entry;
}

export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const entries = await notificationsCollection.read();
  return entries
    .filter((item) => item.user_id === userId)
    .slice(-limit)
    .reverse();
}

export async function unreadCount(userId: string): Promise<number> {
  const entries = await notificationsCollection.read();
  return entries.filter((item) => item.user_id === userId && !item.read).length;
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await notificationsCollection.mutate((entries) =>
    entries.map((item) =>
      item.id === id && item.user_id === userId ? { ...item, read: true } : item,
    ),
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await notificationsCollection.mutate((entries) =>
    entries.map((item) => (item.user_id === userId ? { ...item, read: true } : item)),
  );
}
