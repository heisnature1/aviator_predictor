import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody, ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import { createPackage, packageInputSchema } from '@/lib/packages/package-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';

/** Create a credit package (admin only). */
export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.adminAction);
  const { user } = await requireAdmin();

  const body = packageInputSchema.parse(await readJsonBody(request));
  const created = await createPackage(body);

  await recordAudit({
    admin_id: user.id,
    action: 'admin_created_package',
    target_label: created.name,
    previous_value: null,
    new_value: `${created.credits} ${created.currency} @ ${created.price} ${created.currency_code}`,
    ip_address: clientIp(request),
  });

  return ok({ package: created }, 201);
});
