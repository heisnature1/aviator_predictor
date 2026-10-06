import { NextResponse, type NextRequest } from 'next/server';
import { ok, readJsonBody, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import {
  listNotifications,
  markAllRead,
  markNotificationRead,
  unreadCount,
} from '@/lib/notifications/notification-service';

export const GET = route(async () => {
  const { user } = await requireUser();
  const [notifications, unread] = await Promise.all([
    listNotifications(user.id, 60),
    unreadCount(user.id),
  ]);
  return ok({ notifications, unread });
});

export const PATCH = route(async (request: NextRequest) => {
  const { user } = await requireUser();

  let id: string | null = null;
  try {
    const body = (await readJsonBody(request)) as { id?: string };
    id = body?.id ?? null;
  } catch {
    id = null;
  }

  if (id) await markNotificationRead(user.id, id);
  else await markAllRead(user.id);

  return ok({ unread: await unreadCount(user.id) });
});
