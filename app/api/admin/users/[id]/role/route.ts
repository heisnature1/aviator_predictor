import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody, ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import { changeUserRole } from '@/lib/admin/admin-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';
import { z } from 'zod';

const schema = z.object({ role: z.enum(['user', 'admin']) });

/** Promote / demote administrators (admin only, audited). */
export const POST = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    assertSafeMutation(request, LIMITS.adminAction);
    const { user } = await requireAdmin();
    const { id } = await context.params;

    const body = schema.parse(await readJsonBody(request));
    const updated = await changeUserRole(
      { id: user.id, full_name: user.full_name, ip: clientIp(request) },
      { user_id: id, role: body.role },
    );

    return ok({ user: updated });
  },
);
