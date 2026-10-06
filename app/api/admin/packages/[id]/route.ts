import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody, ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import {
  deletePackage,
  getPackageById,
  packageInputSchema,
  updatePackage,
} from '@/lib/packages/package-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';

/** Edit a credit package (admin only, audited). */
export const PATCH = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    assertSafeMutation(request, LIMITS.adminAction);
    const { user } = await requireAdmin();
    const { id } = await context.params;

    const before = await getPackageById(id);
    if (!before) throw new Error('That package no longer exists.');

    const body = packageInputSchema.partial().parse(await readJsonBody(request));
    const updated = await updatePackage(id, body);

    await recordAudit({
      admin_id: user.id,
      action: 'admin_changed_package',
      target_label: updated.name,
      previous_value: `${before.credits} ${before.currency} @ ${before.price} ${before.currency_code} (active: ${before.active})`,
      new_value: `${updated.credits} ${updated.currency} @ ${updated.price} ${updated.currency_code} (active: ${updated.active})`,
      ip_address: clientIp(request),
    });

    return ok({ package: updated });
  },
);

/** Delete a credit package (admin only, audited). */
export const DELETE = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    assertSafeMutation(request, LIMITS.adminAction);
    const { user } = await requireAdmin();
    const { id } = await context.params;

    const before = await getPackageById(id);
    await deletePackage(id);

    await recordAudit({
      admin_id: user.id,
      action: 'admin_deleted_package',
      target_label: before?.name ?? id,
      previous_value: before ? `${before.credits} ${before.currency}` : null,
      new_value: null,
      ip_address: clientIp(request),
    });

    return ok({ deleted: true });
  },
);
