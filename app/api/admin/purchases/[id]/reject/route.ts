import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody, ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import { rejectPurchase } from '@/lib/payments/purchase-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';
import { z } from 'zod';

const schema = z.object({
  reason: z.string().trim().min(3, 'Provide a reason for the rejection.').max(500),
});

/** Reject a credit purchase (admin only). No credits are granted. */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    assertSafeMutation(request, LIMITS.adminAction);
    const { user } = await requireAdmin();
    const { id } = await context.params;

    const body = schema.parse(await readJsonBody(request));
    const purchase = await rejectPurchase(id, { id: user.id, full_name: user.full_name }, {
      ip: clientIp(request),
      reason: body.reason,
    });

    return ok({ purchase });
  },
);
