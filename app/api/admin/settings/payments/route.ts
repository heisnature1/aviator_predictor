import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody, ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import {
  getPaymentSettings,
  updatePaymentSettings,
  type PaymentSettingsPatch,
} from '@/lib/settings/settings-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';

/** Update payment settings shown to users on the activation page. */
export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.adminAction);
  const { user } = await requireAdmin();

  const before = await getPaymentSettings();
  const body = (await readJsonBody(request)) as Partial<PaymentSettingsPatch>;
  const updated = await updatePaymentSettings(body, user.id);

  const changed = (
    ['activation_fee', 'payment_method', 'payment_number', 'account_name', 'support_contact'] as const
  )
    .filter((key) => String(before[key]) !== String(updated[key]))
    .map((key) => `${key}: ${before[key]} → ${updated[key]}`);

  await recordAudit({
    admin_id: user.id,
    action: 'admin_changed_payment_settings',
    previous_value: changed.length ? 'unchanged' : null,
    new_value: changed.length ? changed.join('; ') : 'no field changes',
    ip_address: clientIp(request),
  });

  return ok({ settings: updated });
});
