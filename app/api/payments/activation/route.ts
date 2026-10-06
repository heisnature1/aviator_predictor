import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, ok, parseBody, route } from '@/lib/http';
import { assertSafeMutation, formFile, formString, readFormData } from '@/lib/http/guard';
import { requireUser } from '@/lib/auth/session';
import { createActivationPayment, listPayments, paymentSubmissionSchema } from '@/lib/payments/payment-service';
import { LIMITS } from '@/lib/auth/rate-limit';

/**
 * Activation payment submission (multipart: fields + receipt file).
 *
 * The payment is always stored as `pending`. Nothing here activates an account
 * or grants credits — only an administrator can do that in /admin/payments.
 */
export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.upload);

  const { user } = await requireUser();
  const form = await readFormData(request);

  const parsed = parseBody(paymentSubmissionSchema, {
    amount: formString(form, 'amount'),
    payment_method: formString(form, 'payment_method'),
    reference: formString(form, 'reference'),
  });

  const payment = await createActivationPayment({
    ...parsed,
    user_id: user.id,
    file: formFile(form, 'receipt'),
    ip: clientIp(request),
  });

  return ok(
    {
      payment,
      message: 'Payment submitted. An administrator will verify your receipt shortly.',
    },
    201,
  );
});

export const GET = route(async () => {
  const { user } = await requireUser();
  const payments = await listPayments({ userId: user.id });
  return ok({ payments });
});
