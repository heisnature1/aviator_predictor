import { z } from 'zod';
import { settingsCollection } from '@/lib/storage/collections';
import { DEFAULT_PAYMENT_SETTINGS, DEFAULT_SYSTEM_SETTINGS } from '@/lib/storage/defaults';
import { nowIso } from '@/lib/utils';
import type { PaymentSettings, SettingsBundle, SystemSettings } from '@/types';

/**
 * Runtime configurable business settings.
 *
 * Values live in data/settings/settings.json and are edited from
 * /admin/settings — they are never hard-coded in the UI.
 */

const paymentSettingsPatch = z.object({
  activation_fee: z.coerce.number().min(0, 'Activation fee cannot be negative.').max(1_000_000),
  currency_code: z.string().trim().min(2).max(8),
  payment_method: z.string().trim().min(2, 'Enter a payment method.').max(60),
  payment_number: z.string().trim().min(4, 'Enter the payment number.').max(60),
  account_name: z.string().trim().min(2, 'Enter the account name.').max(80),
  payment_instructions: z.string().trim().max(1000).default(''),
  support_contact: z.string().trim().max(120).default(''),
});

const systemSettingsPatch = z.object({
  site_name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(160).default(''),
  prediction_cost_gems: z.coerce.number().int().min(0).max(10_000),
  prediction_cost_coins: z.coerce.number().int().min(0).max(10_000),
  activation_bonus_gems: z.coerce.number().int().min(0).max(10_000),
  activation_bonus_coins: z.coerce.number().int().min(0).max(10_000),
  min_data_points: z.coerce.number().int().min(5).max(500),
  history_window: z.coerce.number().int().min(10).max(1000),
  low_balance_threshold: z.coerce.number().int().min(0).max(10_000),
  max_receipt_bytes: z.coerce.number().int().min(100_000).max(20 * 1024 * 1024),
  maintenance_mode: z.coerce.boolean(),
  registration_open: z.coerce.boolean(),
});

export type PaymentSettingsPatch = z.infer<typeof paymentSettingsPatch>;

/** Drops keys that were not supplied so stored values are not overwritten. */
function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
export type SystemSettingsPatch = z.infer<typeof systemSettingsPatch>;

/** Always returns a complete bundle — missing keys fall back to the defaults. */
export async function getSettings(): Promise<SettingsBundle> {
  const stored = await settingsCollection.read();
  return {
    payments: { ...DEFAULT_PAYMENT_SETTINGS, ...(stored?.payments ?? {}) },
    system: { ...DEFAULT_SYSTEM_SETTINGS, ...(stored?.system ?? {}) },
  };
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  return (await getSettings()).payments;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  return (await getSettings()).system;
}

/**
 * Partial update: only the supplied keys are changed, everything else keeps
 * its stored value. Unknown keys are rejected rather than silently ignored.
 */
export async function updatePaymentSettings(
  patch: Partial<PaymentSettingsPatch>,
  actorId: string | null,
): Promise<PaymentSettings> {
  const parsed = paymentSettingsPatch.partial().strict().parse(patch);
  const previous = await getPaymentSettings();
  const next: PaymentSettings = {
    ...previous,
    ...stripUndefined(parsed),
    updated_at: nowIso(),
    updated_by: actorId,
  };
  const bundle = await settingsCollection.mutate((current) => ({
    payments: next,
    system: { ...DEFAULT_SYSTEM_SETTINGS, ...(current?.system ?? {}) },
  }));
  return bundle.payments;
}

export async function updateSystemSettings(
  patch: Partial<SystemSettingsPatch>,
  actorId: string | null,
): Promise<SystemSettings> {
  const parsed = systemSettingsPatch.partial().strict().parse(patch);
  const previous = await getSystemSettings();
  const next: SystemSettings = {
    ...previous,
    ...stripUndefined(parsed),
    updated_at: nowIso(),
    updated_by: actorId,
  };
  const bundle = await settingsCollection.mutate((current) => ({
    payments: { ...DEFAULT_PAYMENT_SETTINGS, ...(current?.payments ?? {}) },
    system: next,
  }));
  return bundle.system;
}
