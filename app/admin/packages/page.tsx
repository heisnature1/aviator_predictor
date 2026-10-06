import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/primitives';
import { PackageManager } from '@/components/admin/PackageManager';
import { requireAdmin } from '@/lib/auth/session';
import { listAllPackages } from '@/lib/packages/package-service';
import { sortBy } from '@/lib/utils';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Packages' };

export default async function AdminPackagesPage() {
  await requireAdmin();
  const packages = await listAllPackages();

  return (
    <div>
      <PageHeader
        title="Credit packages"
        subtitle="Prices and credit amounts are enforced server-side — the client can never override them."
      />
      <PackageManager packages={sortBy(packages, (item) => item.sort_order)} />
    </div>
  );
}
