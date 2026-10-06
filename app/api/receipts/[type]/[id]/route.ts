import { NextResponse, type NextRequest } from 'next/server';
import { Errors, route } from '@/lib/http';
import { requireUser } from '@/lib/auth/session';
import { getPayment } from '@/lib/payments/payment-service';
import { getPurchase } from '@/lib/payments/purchase-service';
import { readReceipt } from '@/lib/storage/files';

/**
 * Private receipt delivery.
 *
 * `storage/receipts` is never publicly exposed — every request is authorised
 * (the owning user or an administrator) and served with an attachment
 * disposition. Missing records return 404 rather than revealing existence.
 */
export const GET = route(
  async (request: NextRequest, context: { params: Promise<{ type: string; id: string }> }) => {
    const { user } = await requireUser();
    const { type, id } = await context.params;

    if (type !== 'payment' && type !== 'purchase') {
      throw Errors.notFound('Receipt not found.');
    }

    const record = type === 'payment' ? await getPayment(id) : await getPurchase(id);
    if (!record) throw Errors.notFound('Receipt not found.');

    const isOwner = record.user_id === user.id;
    if (!isOwner && user.role !== 'admin') {
      throw Errors.notFound('Receipt not found.');
    }

    if (!record.receipt_file) throw Errors.notFound('No receipt was attached to this record.');

    const file = await readReceipt(record.receipt_file);
    if (!file) throw Errors.notFound('The receipt file is no longer available.');

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'content-type': file.mime,
        'content-disposition': `attachment; filename="${file.fileName}"`,
        'content-length': String(file.buffer.byteLength),
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  },
);
