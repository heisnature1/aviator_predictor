import { NextResponse, type NextRequest } from 'next/server';
import { ok, readJsonBody, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import { approvePurchase } from '@/lib/payments/purchase-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';

/**
 * Approve a credit purchase (admin only).
 * This is the only code path that grants credits for a purchase.
 */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    assertSafeMutation(request, LIMITS.adminAction);
    const { user } = await requireAdmin();
    const { id } = await context.params;

    let note: string | null = null;
    try {
      const body = (await readJsonBody(request)) as { note?: string };
      note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null;
    } catch {
      // An empty or non-JSON body is valid here — the note is optional.
      note = null;
    }

    const purchase = await approvePurchase(id, { id: user.id, full_name: user.full_name }, {
      ip: clientIp(request),
      note,
    });

    return ok({ purchase });
  },
);
