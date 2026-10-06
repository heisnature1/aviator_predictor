import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody, ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import { adjustWallet } from '@/lib/admin/admin-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';
import { z } from 'zod';

const schema = z.object({
  currency: z.enum(['gems', 'coins']),
  amount: z.coerce
    .number()
    .int('Credits must be a whole number.')
    .refine((value) => value !== 0, 'Enter a non-zero amount.')
    .refine((value) => Math.abs(value) <= 100000, 'Adjustments are limited to 100,000 credits.'),
  reason: z.string().trim().min(3, 'A reason is required.').max(300),
});

/**
 * Manual wallet adjustment (admin only).
 * Always writes a transaction row and an audit entry.
 */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    assertSafeMutation(request, LIMITS.adminAction);
    const { user } = await requireAdmin();
    const { id } = await context.params;

    const body = schema.parse(await readJsonBody(request));
    const result = await adjustWallet(
      { id: user.id, full_name: user.full_name, ip: clientIp(request) },
      { user_id: id, currency: body.currency, amount: body.amount, reason: body.reason },
    );

    return ok(result);
  },
);
