import type { Metadata } from 'next';
import Link from 'next/link';
import { HardDrive } from 'lucide-react';
import { PageHeader, Callout, StatCard } from '@/components/ui/primitives';
import { SystemSettingsForm } from '@/components/admin/SettingsForms';
import { requireAdmin } from '@/lib/auth/session';
import { getSystemSettings } from '@/lib/settings/settings-service';
import { describeStorage } from '@/lib/storage/database';
import { getFeedDiagnostics } from '@/lib/aviator/live-feed';
import { formatDateTimeUtc } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'System Settings' };

export default async function AdminSystemSettingsPage() {
  await requireAdmin();
  const [settings, storage, feed] = await Promise.all([
    getSystemSettings(),
    Promise.resolve(describeStorage()),
    Promise.resolve(getFeedDiagnostics()),
  ]);

  return (
    <div>
      <PageHeader
        title="System settings"
        subtitle="Prediction pricing, activation bonuses, analysis thresholds and platform switches."
        actions={
          <Link href="/admin/settings/payments" className="btn-secondary btn-sm">
            Payment settings
          </Link>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Storage mode" value={storage.mode} hint={storage.label} icon={<HardDrive className="h-4 w-4" />} tone={storage.persistent ? 'success' : 'warning'} />
        <StatCard label="Aviator provider" value={feed.provider} hint={`mode: ${feed.mode}`} />
        <StatCard
          label="Last provider error"
          value={feed.last_error ? 'Yes' : 'None'}
          hint={feed.last_error ?? 'Feed healthy'}
          tone={feed.last_error ? 'danger' : 'success'}
        />
      </div>

      {storage.warning ? (
        <div className="mb-5">
          <Callout tone="warning" title="Durability warning" icon={<HardDrive className="h-4 w-4" />}>
            {storage.warning}
          </Callout>
        </div>
      ) : null}

      <SystemSettingsForm settings={settings} />

      <p className="mt-3 text-[11px] text-slate-500">
        Last updated {formatDateTimeUtc(settings.updated_at)}
        {settings.updated_by ? ` by ${settings.updated_by}` : ''}.
      </p>
    </div>
  );
}
