import { Errors } from '@/lib/http';
import { userStats } from '@/lib/users/user-service';
import { paymentStats } from '@/lib/payments/payment-service';
import { purchaseStats } from '@/lib/payments/purchase-service';
import { predictionStats } from '@/lib/predictions/prediction-history';
import { walletSummary } from '@/lib/wallet/wallet-service';
import { listAudit } from '@/lib/audit/audit-service';
import { notify } from '@/lib/notifications/notification-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { getUserById, setAccountStatus, setUserRole } from '@/lib/users/user-service';
import { applyWalletChange, getWallet } from '@/lib/wallet/wallet-service';
import type { AccountStatus, UserRole, WalletCurrency } from '@/types';

/** Aggregated dashboards and privileged user/wallet operations. */

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingAccounts: number;
  pendingPayments: number;
  pendingPurchases: number;
  creditsSold: number;
  predictionRequests: number;
  predictionsGenerated: number;
  approvedRevenue: number;
  gemsInCirculation: number;
  coinsInCirculation: number;
}

export async function dashboardStats(): Promise<DashboardStats> {
  const [users, payments, purchases, predictions, wallets] = await Promise.all([
    userStats(),
    paymentStats(),
    purchaseStats(),
    predictionStats(),
    walletSummary(),
  ]);

  return {
    totalUsers: users.total,
    activeUsers: users.active,
    pendingAccounts: users.pending,
    pendingPayments: payments.pending,
    pendingPurchases: purchases.pending,
    creditsSold: purchases.creditsSold,
    predictionRequests: predictions.total,
    predictionsGenerated: predictions.generated,
    approvedRevenue: purchases.revenue + payments.approvedValue,
    gemsInCirculation: wallets.gemsInCirculation,
    coinsInCirculation: wallets.coinsInCirculation,
  };
}

export async function recentActivity(limit = 12) {
  return listAudit(limit);
}

export interface AdminActor {
  id: string;
  full_name: string;
  ip?: string | null;
}

export async function adjustWallet(
  actor: AdminActor,
  input: { user_id: string; currency: WalletCurrency; amount: number; reason: string },
): Promise<{ balance_after: number; balance_before: number }> {
  const reason = input.reason?.trim();
  if (!reason || reason.length < 3) {
    throw Errors.invalid('A reason is required for every manual wallet adjustment.', {
      reason: 'Enter a reason (e.g. customer compensation).',
    });
  }
  const amount = Math.trunc(input.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    throw Errors.invalid('Enter a non-zero whole number of credits.');
  }

  const user = await getUserById(input.user_id);
  if (!user) throw Errors.notFound('That user no longer exists.');

  const before = await getWallet(user.id);
  const result = await applyWalletChange({
    user_id: user.id,
    currency: input.currency,
    amount,
    type: 'admin_adjustment',
    reference: `admin:${actor.id}`,
    description: `${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount).toLocaleString()} ${input.currency} — ${reason}`,
    actor_id: actor.id,
    allow_overdraft: false,
  });

  await notify({
    user_id: user.id,
    kind: 'system',
    title: amount > 0 ? 'Credits added' : 'Credits removed',
    message: `${amount > 0 ? '+' : ''}${amount.toLocaleString()} ${input.currency} — ${reason}`,
    link: '/wallet',
  });

  await recordAudit({
    admin_id: actor.id,
    action: amount > 0 ? 'admin_added_credits' : 'admin_removed_credits',
    target_user: user.id,
    target_label: `${user.full_name} (${user.email})`,
    previous_value: `${input.currency}:${before[input.currency]}`,
    new_value: `${input.currency}:${result.balance_after}`,
    reason,
    ip_address: actor.ip ?? null,
  });

  return { balance_after: result.balance_after, balance_before: result.balance_before };
}

export async function changeAccountStatus(
  actor: AdminActor,
  input: { user_id: string; status: AccountStatus; reason?: string | null },
) {
  const user = await getUserById(input.user_id);
  if (!user) throw Errors.notFound('That user no longer exists.');
  if (user.id === actor.id && input.status !== 'active') {
    throw Errors.invalid('You cannot suspend or reject your own administrator account.');
  }

  const previous = user.account_status;
  const updated = await setAccountStatus(user.id, input.status, input.reason ?? null);

  const actionMap: Record<AccountStatus, 'admin_activated_account' | 'admin_rejected_account' | 'admin_suspended_account'> = {
    active: 'admin_activated_account',
    rejected: 'admin_rejected_account',
    suspended: 'admin_suspended_account',
    pending: 'admin_activated_account',
  };

  await notify({
    user_id: user.id,
    kind: input.status === 'active' ? 'account_approved' : input.status === 'rejected' ? 'account_rejected' : 'system',
    title:
      input.status === 'active'
        ? 'Account activated'
        : input.status === 'rejected'
          ? 'Account rejected'
          : input.status === 'suspended'
            ? 'Account suspended'
            : 'Account status updated',
    message:
      input.reason?.trim() ||
      `An administrator set your account status to ${input.status}.`,
    link: '/dashboard',
  });

  await recordAudit({
    admin_id: actor.id,
    action: actionMap[input.status] ?? 'system',
    target_user: user.id,
    target_label: `${user.full_name} (${user.email})`,
    previous_value: `account:${previous}`,
    new_value: `account:${input.status}`,
    reason: input.reason ?? null,
    ip_address: actor.ip ?? null,
  });

  return updated;
}

export async function changeUserRole(
  actor: AdminActor,
  input: { user_id: string; role: UserRole },
) {
  const user = await getUserById(input.user_id);
  if (!user) throw Errors.notFound('That user no longer exists.');
  if (user.id === actor.id && input.role !== 'admin') {
    throw Errors.invalid('You cannot remove your own administrator privileges.');
  }
  if (user.role === input.role) return user;

  const updated = await setUserRole(user.id, input.role);

  await recordAudit({
    admin_id: actor.id,
    action: 'admin_changed_role',
    target_user: user.id,
    target_label: `${user.full_name} (${user.email})`,
    previous_value: `role:${user.role}`,
    new_value: `role:${input.role}`,
    reason: null,
    ip_address: actor.ip ?? null,
  });

  return updated;
}
