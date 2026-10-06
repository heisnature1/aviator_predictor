import { NextResponse, type NextRequest } from 'next/server';
import { ok, parseBody, route } from '@/lib/http';
import { assertSafeMutation, formFile, formString, readFormData } from '@/lib/http/guard';
import { requireUser } from '@/lib/auth/session';
import { createPurchase, listPurchases, purchaseSubmissionSchema } from '@/lib/payments/purchase-service';
import { LIMITS } from '@/lib/auth/rate-limit';

/**
 * Credit purchase submission (multipart).
 *
 * Price and credit amount are resolved from the server-side package record —
 * client supplied values are ignored except as a typed amount to verify.
 * Credits are granted only when an administrator approves the purchase.
 */
export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.upload);

  const { user } = await requireUser();
  const form = await readFormData(request);

  const parsed = parseBody(purchaseSubmissionSchema, {
    package_id: formString(form, 'package_id'),
    amount: formString(form, 'amount'),
    payment_method: formString(form, 'payment_method'),
    reference: formString(form, 'reference'),
  });

  const purchase = await createPurchase({
    ...parsed,
    user_id: user.id,
    file: formFile(form, 'receipt'),
  });

  return ok(
    {
      purchase,
      message: 'Purchase submitted. Credits are added once an administrator verifies the payment.',
    },
    201,
  );
});

export const GET = route(async () => {
  const { user } = await requireUser();
  const purchases = await listPurchases({ userId: user.id });
  return ok({ purchases });
});
