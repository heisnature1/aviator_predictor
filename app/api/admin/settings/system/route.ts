import { NextResponse, type NextRequest } from 'next/server';
import { readJsonBody, ok, route } from '@/lib/http';
import { assertSafeMutation } from '@/lib/http/guard';
import { requireAdmin } from '@/lib/auth/session';
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettingsPatch,
} from '@/lib/settings/settings-service';
import { recordAudit } from '@/lib/audit/audit-service';
import { LIMITS } from '@/lib/auth/rate-limit';
import { clientIp } from '@/lib/http';

/** Update platform system settings (costs, bonuses, thresholds). */
export const POST = route(async (request: NextRequest) => {
  assertSafeMutation(request, LIMITS.adminAction);
  const { user } = await requireAdmin();

  const before = await getSystemSettings();
  const body = (await readJsonBody(request)) as Partial<SystemSettingsPatch>;
  const updated = await updateSystemSettings(body, user.id);

  const keys = Object.keys(body) as (keyof SystemSettingsPatch)[];
  const changed = keys
    .filter((key) => String(before[key]) !== String(updated[key]))
    .map((key) => `${String(key)}: ${String(before[key])} → ${String(updated[key])}`);

  await recordAudit({
    admin_id: user.id,
    action: 'admin_changed_system_settings',
    previous_value: null,
    new_value: changed.length ? changed.join('; ') : 'no field changes',
    ip_address: clientIp(request),
  });

  return ok({ settings: updated });
});
