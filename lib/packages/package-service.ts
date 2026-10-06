import { z } from 'zod';
import { packagesCollection } from '@/lib/storage/collections';
import { DEFAULT_PACKAGES } from '@/lib/storage/defaults';
import { Errors } from '@/lib/http';
import { newId, nowIso, sortBy } from '@/lib/utils';
import type { CreditPackage, WalletCurrency } from '@/types';

/**
 * Credit packages.
 *
 * Packages are administrator controlled (data/packages/packages.json).
 * Prices and credit amounts are ALWAYS re-read server-side — a client supplied
 * price or credit amount is never honoured.
 */

export const packageInputSchema = z.object({
  name: z.string().trim().min(2, 'Enter a package name.').max(40),
  currency: z.enum(['gems', 'coins']),
  credits: z.coerce.number().int().min(1, 'Credits must be at least 1.').max(1_000_000),
  price: z.coerce.number().min(0, 'Price cannot be negative.').max(1_000_000),
  currency_code: z.string().trim().min(2).max(8).default('GHS'),
  description: z.string().trim().max(120).optional().default(''),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(10),
});

export type PackageInput = z.infer<typeof packageInputSchema>;

export async function listPackages(options: { includeInactive?: boolean } = {}): Promise<CreditPackage[]> {
  const packages = await packagesCollection.read();
  const filtered = options.includeInactive ? packages : packages.filter((item) => item.active);
  return sortBy(filtered, (item) => item.sort_order);
}

export async function listAllPackages(): Promise<CreditPackage[]> {
  return listPackages({ includeInactive: true });
}

export async function getPackageById(id: string): Promise<CreditPackage | null> {
  const packages = await packagesCollection.read();
  return packages.find((item) => item.id === id) ?? null;
}

/**
 * Server-side price/credit lookup used by the purchase flow.
 * Throws when the package is missing or disabled.
 */
export async function resolvePackageForPurchase(id: string): Promise<CreditPackage> {
  const pkg = await getPackageById(id);
  if (!pkg) throw Errors.invalid('That credit package no longer exists.');
  if (!pkg.active) throw Errors.invalid('That credit package is no longer available.');
  return pkg;
}

export async function createPackage(input: PackageInput): Promise<CreditPackage> {
  const parsed = packageInputSchema.parse(input);
  const timestamp = nowIso();
  const created: CreditPackage = {
    id: newId('pkg'),
    name: parsed.name,
    currency: parsed.currency as WalletCurrency,
    credits: parsed.credits,
    price: parsed.price,
    currency_code: parsed.currency_code,
    description: parsed.description ?? '',
    active: parsed.active,
    sort_order: parsed.sort_order,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await packagesCollection.mutate((packages) => [...packages, created]);
  return created;
}

export async function updatePackage(
  id: string,
  input: Partial<PackageInput>,
): Promise<CreditPackage> {
  const parsed = packageInputSchema.partial().parse(input);
  let updated: CreditPackage | null = null;
  await packagesCollection.mutate((packages) =>
    packages.map((item) => {
      if (item.id !== id) return item;
      updated = {
        ...item,
        ...parsed,
        currency: (parsed.currency ?? item.currency) as WalletCurrency,
        updated_at: nowIso(),
      };
      return updated;
    }),
  );
  if (!updated) throw Errors.notFound('That package no longer exists.');
  return updated as CreditPackage;
}

export async function setPackageActive(id: string, active: boolean): Promise<CreditPackage> {
  let updated: CreditPackage | null = null;
  await packagesCollection.mutate((packages) =>
    packages.map((item) => {
      if (item.id !== id) return item;
      updated = { ...item, active, updated_at: nowIso() };
      return updated;
    }),
  );
  if (!updated) throw Errors.notFound('That package no longer exists.');
  return updated as CreditPackage;
}

export async function deletePackage(id: string): Promise<void> {
  let removed = false;
  await packagesCollection.mutate((packages) => {
    const next = packages.filter((item) => item.id !== id);
    removed = next.length !== packages.length;
    return next;
  });
  if (!removed) throw Errors.notFound('That package no longer exists.');
}

/** Restores the catalogue the first time the store is created. */
export async function ensureDefaultPackages(): Promise<void> {
  await packagesCollection.mutate((current) =>
    current.length === 0 ? DEFAULT_PACKAGES : current,
  );
}
