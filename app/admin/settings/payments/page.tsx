import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Callout } from '@/components/ui/primitives';
import { PaymentSettingsForm } from '@/components/admin/SettingsForms';
import { requireAdmin } from '@/lib/auth/session';
import { getPaymentSettings } from '@/lib/settings/settings-service';
import { formatDateTimeUtc } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Payment Settings' };

export default async function AdminPaymentSettingsPage() {
  await requireAdmin();
  const settings = await getPaymentSettings();

  return (
    <div>
      <PageHeader
        title="Payment settings"
        subtitle="These values are shown to users on the activation and wallet pages. Changes apply immediately."
        actions={
          <Link href="/admin/settings" className="btn-secondary btn-sm">
            System settings
          </Link>
        }
      />

      <div className="mb-5">
        <Callout tone="info" title="Live preview">
          Users will see: send <strong>{settings.currency_code} {settings.activation_fee}</strong> to{' '}
          <strong>{settings.payment_number}</strong> ({settings.payment_method}, account{' '}
          {settings.account_name}).
        </Callout>
      </div>

      <PaymentSettingsForm settings={settings} />

      <p className="mt-3 text-[11px] text-slate-500">
        Last updated {formatDateTimeUtc(settings.updated_at)}
        {settings.updated_by ? ` by ${settings.updated_by}` : ''}. Every change is written to the
        audit log.
      </p>
    </div>
  );
}
