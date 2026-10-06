import { NextResponse } from 'next/server';
import { ok, route } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { unreadCount } from '@/lib/notifications/notification-service';
import { getBalances } from '@/lib/wallet/wallet-service';

/** Returns the signed-in user, or `null`. Used by client components. */
export const GET = route(async () => {
  const context = await getCurrentUser();
  if (!context) return ok({ user: null, unread: 0, balance: null });

  const [unread, balance] = await Promise.all([
    unreadCount(context.user.id),
    getBalances(context.user.id),
  ]);

  return ok({ user: context.publicUser, unread, balance });
});
