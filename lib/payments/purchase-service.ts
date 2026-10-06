import { z } from 'zod';
import { purchasesCollection } from '@/lib/storage/collections';
import { createLock } from '@/lib/storage/lock';
import { storeReceipt, type IncomingFile } from '@/lib/storage/files';
import { Errors } from '@/lib/http';
import { getPaymentSettings, getSystemSettings } from '@/lib/settings/settings-service';
import { getUserById } from '@/lib/users/user-service';
import { resolvePackageForPurchase } from '@/lib/packages/package-service';
import { creditWallet } from '@/lib/wallet/wallet-service';
import { notify } from '@/lib/notifications/notification-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { formatCurrency, newId, nowIso } from '@/lib/utils';
import type { PaymentStatus, Purchase } from '@/types';

/**
 * Credit purchases.
 *
 * Uploading a receipt does NOT add credits. A purchase stays `pending` until an
 * administrator approves it — only then are credits added to the wallet and a
 * ledger transaction written.
 */

const reviewLock = createLock();

export const purchaseSubmissionSchema = z.object({
  package_id: z.string().trim().min(1, 'Select a credit package.'),
  amount: z.coerce.number().positive('Enter the amount you paid.').max(1_000_000),
  payment_method: z.string().trim().min(2, 'Select a payment method.').max(60),
  reference: z
    .string()
    .trim()
    .min(4, 'Enter the transaction reference from your payment confirmation.')
    .max(64),
});

export type PurchaseSubmissionInput = z.infer<typeof purchaseSubmissionSchema>;

export interface SubmitPurchaseInput extends PurchaseSubmissionInput {
  user_id: string;
  file?: IncomingFile | null;
}

export async function createPurchase(input: SubmitPurchaseInput): Promise<Purchase> {
  const parsed = purchaseSubmissionSchema.parse(input);
  const systemSettings = await getSystemSettings();
  const paymentSettings = await getPaymentSettings();

  // Price and credit amount are read from the server-side package record.
  const pkg = await resolvePackageForPurchase(parsed.package_id);
  if (Math.abs(parsed.amount - pkg.price) > 0.01) {
    throw Errors.invalid(
      `The amount must match the package price of ${formatCurrency(pkg.price, pkg.currency_code)}.`,
      { amount: `Enter exactly ${pkg.price}.` },
    );
  }

  const user = await getUserById(input.user_id);
  if (!user) throw Errors.notFound('Account not found.');
  if (user.account_status !== 'active') {
    throw Errors.forbidden('Your account must be active before buying credits.');
  }

  if (!input.file) {
    throw Errors.invalid('Please attach your payment receipt.', {
      receipt: 'A receipt is required.',
    });
  }

  const receipt = await storeReceipt(input.user_id, input.file, {
    maxBytes: systemSettings.max_receipt_bytes,
  });

  const purchase: Purchase = {
    id: newId('pur'),
    user_id: input.user_id,
    package_id: pkg.id,
    package_name: pkg.name,
    currency: pkg.currency,
    credits: pkg.credits,
    amount: parsed.amount,
    currency_code: pkg.currency_code || paymentSettings.currency_code,
    payment_method: parsed.payment_method,
    reference: parsed.reference,
    receipt_file: receipt.relativePath,
    receipt_name: input.file.name || receipt.fileName,
    status: 'pending',
    admin_note: null,
    created_at: nowIso(),
    reviewed_at: null,
    reviewed_by: null,
    rejection_reason: null,
  };

  await purchasesCollection.mutate((purchases) => [...purchases, purchase]);

  await notify({
    user_id: input.user_id,
    kind: 'purchase_submitted',
    title: 'Credit purchase received',
    message: `Your ${pkg.name} purchase (${formatCurrency(
      parsed.amount,
      purchase.currency_code,
    )}) is waiting for verification.`,
    link: '/wallet',
  });

  return purchase;
}

export async function listPurchases(filter: { status?: PaymentStatus; userId?: string } = {}) {
  const purchases = await purchasesCollection.read();
  return purchases
    .filter((purchase) => (filter.status ? purchase.status === filter.status : true))
    .filter((purchase) => (filter.userId ? purchase.user_id === filter.userId : true))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getPurchase(id: string): Promise<Purchase | null> {
  const purchases = await purchasesCollection.read();
  return purchases.find((purchase) => purchase.id === id) ?? null;
}

export async function approvePurchase(
  id: string,
  admin: { id: string; full_name: string },
  context: { ip?: string | null; note?: string | null } = {},
): Promise<Purchase> {
  return reviewLock.runExclusive(async () => {
    const purchases = await purchasesCollection.read();
    const purchase = purchases.find((item) => item.id === id);
    if (!purchase) throw Errors.notFound('That purchase no longer exists.');
    if (purchase.status !== 'pending') {
      throw Errors.conflict(`This purchase has already been ${purchase.status}.`);
    }

    const timestamp = nowIso();
    const updated: Purchase = {
      ...purchase,
      status: 'approved',
      admin_note: context.note ?? null,
      reviewed_at: timestamp,
      reviewed_by: admin.id,
    };
    await purchasesCollection.write(purchases.map((item) => (item.id === id ? updated : item)));

    // Credits are granted here — the only place a purchase can mint credits.
    await creditWallet({
      user_id: purchase.user_id,
      currency: purchase.currency,
      amount: purchase.credits,
      type: purchase.currency === 'gems' ? 'gem_purchase' : 'coin_purchase',
      reference: purchase.id,
      description: `${purchase.package_name} — approved by ${admin.full_name}`,
      actor_id: admin.id,
    });

    await notify({
      user_id: purchase.user_id,
      kind: 'purchase_approved',
      title: 'Credits added',
      message: `${purchase.credits.toLocaleString()} ${purchase.currency} from your ${purchase.package_name} purchase have been added to your wallet.`,
      link: '/wallet',
    });

    await recordAudit({
      admin_id: admin.id,
      action: 'admin_approved_purchase',
      target_user: purchase.user_id,
      target_label: `${purchase.package_name} (${purchase.id})`,
      previous_value: 'purchase:pending',
      new_value: `purchase:approved +${purchase.credits} ${purchase.currency}`,
      reason: context.note ?? null,
      ip_address: context.ip ?? null,
    });

    return updated;
  });
}

export async function rejectPurchase(
  id: string,
  admin: { id: string; full_name: string },
  context: { ip?: string | null; reason: string },
): Promise<Purchase> {
  const reason = context.reason?.trim();
  if (!reason || reason.length < 3) {
    throw Errors.invalid('Provide a reason for rejecting this purchase.', {
      reason: 'A rejection reason is required.',
    });
  }

  return reviewLock.runExclusive(async () => {
    const purchases = await purchasesCollection.read();
    const purchase = purchases.find((item) => item.id === id);
    if (!purchase) throw Errors.notFound('That purchase no longer exists.');
    if (purchase.status !== 'pending') {
      throw Errors.conflict(`This purchase has already been ${purchase.status}.`);
    }

    const updated: Purchase = {
      ...purchase,
      status: 'rejected',
      admin_note: reason,
      rejection_reason: reason,
      reviewed_at: nowIso(),
      reviewed_by: admin.id,
    };
    await purchasesCollection.write(purchases.map((item) => (item.id === id ? updated : item)));

    // Deliberately no wallet change — a rejected purchase never adds credits.
    await notify({
      user_id: purchase.user_id,
      kind: 'purchase_rejected',
      title: 'Credit purchase rejected',
      message: reason,
      link: '/wallet',
    });

    await recordAudit({
      admin_id: admin.id,
      action: 'admin_rejected_purchase',
      target_user: purchase.user_id,
      target_label: `${purchase.package_name} (${purchase.id})`,
      previous_value: 'purchase:pending',
      new_value: 'purchase:rejected',
      reason,
      ip_address: context.ip ?? null,
    });

    return updated;
  });
}

export async function purchaseStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  creditsSold: number;
  revenue: number;
}> {
  const purchases = await purchasesCollection.read();
  return {
    pending: purchases.filter((purchase) => purchase.status === 'pending').length,
    approved: purchases.filter((purchase) => purchase.status === 'approved').length,
    rejected: purchases.filter((purchase) => purchase.status === 'rejected').length,
    creditsSold: purchases
      .filter((purchase) => purchase.status === 'approved')
      .reduce((total, purchase) => total + purchase.credits, 0),
    revenue: purchases
      .filter((purchase) => purchase.status === 'approved')
      .reduce((total, purchase) => total + purchase.amount, 0),
  };
}
