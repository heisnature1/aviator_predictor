import { z } from 'zod';
import { paymentsCollection } from '@/lib/storage/collections';
import { withStorageTransaction } from '@/lib/storage/database';
import { createLock } from '@/lib/storage/lock';
import { deleteReceipt, storeReceipt, type IncomingFile } from '@/lib/storage/files';
import { Errors } from '@/lib/http';
import { getPaymentSettings, getSystemSettings } from '@/lib/settings/settings-service';
import { getUserById, setAccountStatus } from '@/lib/users/user-service';
import { creditWallet } from '@/lib/wallet/wallet-service';
import { notify } from '@/lib/notifications/notification-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { formatCurrency, newId, nowIso } from '@/lib/utils';
import type { Payment, PaymentStatus } from '@/types';

/**
 * Account activation payments.
 *
 * A submitted payment is ALWAYS `pending`. Only an administrator can approve
 * it, and only approval activates the account and grants the activation bonus.
 */

const reviewLock = createLock();

export const paymentSubmissionSchema = z.object({
  amount: z.coerce.number().positive('Enter the amount you paid.').max(1_000_000),
  payment_method: z.string().trim().min(2, 'Select a payment method.').max(60),
  reference: z
    .string()
    .trim()
    .min(4, 'Enter the transaction reference from your payment confirmation.')
    .max(64),
});

export type PaymentSubmissionInput = z.infer<typeof paymentSubmissionSchema>;

export interface SubmitPaymentInput extends PaymentSubmissionInput {
  user_id: string;
  file?: IncomingFile | null;
  ip?: string | null;
}

export async function createActivationPayment(input: SubmitPaymentInput): Promise<Payment> {
  const parsed = paymentSubmissionSchema.parse(input);
  const [paymentSettings, systemSettings] = await Promise.all([
    getPaymentSettings(),
    getSystemSettings(),
  ]);

  // Server-side price check — the client supplied amount is never trusted.
  if (Math.abs(parsed.amount - paymentSettings.activation_fee) > 0.01) {
    throw Errors.invalid(
      `The amount must match the activation fee of ${formatCurrency(
        paymentSettings.activation_fee,
        paymentSettings.currency_code,
      )}.`,
      { amount: `Enter exactly ${paymentSettings.activation_fee}.` },
    );
  }

  const existing = await paymentsCollection.read();
  const alreadyPending = existing.some(
    (payment) =>
      payment.user_id === input.user_id &&
      payment.type === 'account_activation' &&
      payment.status === 'pending',
  );
  if (alreadyPending) {
    throw Errors.conflict(
      'You already have an activation payment waiting for review. We will notify you as soon as it is verified.',
    );
  }

  const user = await getUserById(input.user_id);
  if (!user) throw Errors.notFound('Account not found.');
  if (user.account_status === 'active') {
    throw Errors.conflict('Your account is already active.');
  }

  let receipt: Awaited<ReturnType<typeof storeReceipt>> | null = null;
  if (input.file) {
    receipt = await storeReceipt(input.user_id, input.file, {
      maxBytes: systemSettings.max_receipt_bytes,
    });
  } else {
    throw Errors.invalid('Please attach your payment receipt.', {
      receipt: 'A receipt is required.',
    });
  }

  const payment: Payment = {
    id: newId('pay'),
    user_id: input.user_id,
    type: 'account_activation',
    amount: parsed.amount,
    currency_code: paymentSettings.currency_code,
    payment_method: parsed.payment_method,
    reference: parsed.reference,
    receipt_file: receipt?.relativePath ?? null,
    receipt_name: input.file?.name ?? receipt?.fileName ?? null,
    status: 'pending',
    admin_note: null,
    created_at: nowIso(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
  };

  try {
    await paymentsCollection.mutate((payments) => {
      const alreadyPending = payments.some(
        (item) =>
          item.user_id === input.user_id &&
          item.type === 'account_activation' &&
          item.status === 'pending',
      );
      if (alreadyPending) {
        throw Errors.conflict(
          'You already have an activation payment waiting for review. We will notify you as soon as it is verified.',
        );
      }
      return [...payments, payment];
    });
  } catch (error) {
    if (receipt) await deleteReceipt(receipt.relativePath).catch(() => undefined);
    throw error;
  }

  await notify({
    user_id: input.user_id,
    kind: 'payment_submitted',
    title: 'Activation payment received',
    message: `Your payment of ${formatCurrency(
      parsed.amount,
      paymentSettings.currency_code,
    )} is waiting for verification. We will notify you once an administrator reviews it.`,
    link: '/payments',
  });

  return payment;
}

export async function listPayments(filter: { status?: PaymentStatus; userId?: string } = {}) {
  const payments = await paymentsCollection.read();
  return payments
    .filter((payment) => payment.type === 'account_activation')
    .filter((payment) => (filter.status ? payment.status === filter.status : true))
    .filter((payment) => (filter.userId ? payment.user_id === filter.userId : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getPayment(id: string): Promise<Payment | null> {
  const payments = await paymentsCollection.read();
  return payments.find((payment) => payment.id === id) ?? null;
}

export async function approvePayment(
  id: string,
  admin: { id: string; full_name: string },
  context: { ip?: string | null; note?: string | null } = {},
): Promise<{ payment: Payment; activated: boolean }> {
  return withStorageTransaction(
    () => reviewLock.runExclusive(async () => {
      const payments = await paymentsCollection.read();
      const payment = payments.find((item) => item.id === id);
      if (!payment) throw Errors.notFound('That payment no longer exists.');
      if (payment.status !== 'pending') {
        throw Errors.conflict(`This payment has already been ${payment.status}.`);
      }

      const user = await getUserById(payment.user_id);
      if (!user) throw Errors.notFound('The account for this payment no longer exists.');

      const timestamp = nowIso();
      const updated: Payment = {
        ...payment,
        status: 'approved',
        admin_note: context.note ?? null,
        reviewed_at: timestamp,
        reviewed_by: admin.id,
      };
      await paymentsCollection.mutate((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );

      const previousStatus = user.account_status;
      await setAccountStatus(user.id, 'active', 'Activated after payment approval');

      const systemSettings = await getSystemSettings();
      const paymentSettings = await getPaymentSettings();

      if (systemSettings.activation_bonus_gems > 0) {
        await creditWallet({
          user_id: user.id,
          currency: 'gems',
          amount: systemSettings.activation_bonus_gems,
          type: 'account_activation',
          reference: updated.id,
          description: `Activation bonus — ${systemSettings.activation_bonus_gems} gems`,
          actor_id: admin.id,
        });
      }
      if (systemSettings.activation_bonus_coins > 0) {
        await creditWallet({
          user_id: user.id,
          currency: 'coins',
          amount: systemSettings.activation_bonus_coins,
          type: 'account_activation',
          reference: updated.id,
          description: `Activation bonus — ${systemSettings.activation_bonus_coins} coins`,
          actor_id: admin.id,
        });
      }

      await notify({
        user_id: user.id,
        kind: 'account_approved',
        title: 'Account activated',
        message: `Your activation payment was approved. Your account is now active${
          systemSettings.activation_bonus_gems > 0
            ? ` and ${systemSettings.activation_bonus_gems} gems have been added to your wallet.`
            : '.'
        }`,
        link: '/dashboard',
      });

      await recordAudit({
        admin_id: admin.id,
        action: 'admin_approved_payment',
        target_user: user.id,
        target_label: `${user.full_name} (${user.email})`,
        previous_value: `payment:${payment.status} account:${previousStatus}`,
        new_value: `payment:approved account:active`,
        reason: context.note ?? null,
        ip_address: context.ip ?? null,
      });

      return { payment: updated, activated: true };
    }),
    'aviator:payment-review',
  );
}

export async function rejectPayment(
  id: string,
  admin: { id: string; full_name: string },
  context: { ip?: string | null; reason: string },
): Promise<Payment> {
  const reason = context.reason?.trim();
  if (!reason || reason.length < 3) {
    throw Errors.invalid('Provide a reason for rejecting this payment.', {
      reason: 'A rejection reason is required.',
    });
  }

  return withStorageTransaction(
    () => reviewLock.runExclusive(async () => {
      const payments = await paymentsCollection.read();
      const payment = payments.find((item) => item.id === id);
      if (!payment) throw Errors.notFound('That payment no longer exists.');
      if (payment.status !== 'pending') {
        throw Errors.conflict(`This payment has already been ${payment.status}.`);
      }

      const user = await getUserById(payment.user_id);
      const timestamp = nowIso();
      const updated: Payment = {
        ...payment,
        status: 'rejected',
        admin_note: reason,
        rejection_reason: reason,
        reviewed_at: timestamp,
        reviewed_by: admin.id,
      };
      await paymentsCollection.mutate((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );

      if (user) {
        const previousStatus = user.account_status;
        await setAccountStatus(user.id, 'rejected', reason);
        await notify({
          user_id: user.id,
          kind: 'account_rejected',
          title: 'Activation payment rejected',
          message: reason,
          link: '/payments',
        });
        await recordAudit({
          admin_id: admin.id,
          action: 'admin_rejected_payment',
          target_user: user.id,
          target_label: `${user.full_name} (${user.email})`,
          previous_value: `payment:${payment.status} account:${previousStatus}`,
          new_value: 'payment:rejected account:rejected',
          reason,
          ip_address: context.ip ?? null,
        });
      }

      return updated;
    }),
    'aviator:payment-review',
  );
}

export async function paymentStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  approvedValue: number;
}> {
  const payments = await paymentsCollection.read();
  const activation = payments.filter((payment) => payment.type === 'account_activation');
  return {
    pending: activation.filter((payment) => payment.status === 'pending').length,
    approved: activation.filter((payment) => payment.status === 'approved').length,
    rejected: activation.filter((payment) => payment.status === 'rejected').length,
    approvedValue: activation
      .filter((payment) => payment.status === 'approved')
      .reduce((total, payment) => total + payment.amount, 0),
  };
}
