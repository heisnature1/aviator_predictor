import type { CreditPackage, PaymentSettings, SystemSettings } from '@/types';

/**
 * Seed values written the first time the storage layer initialises.
 *
 * These are *defaults only* — every value below is administrator controlled at
 * runtime via /admin/settings and /admin/packages, and is stored in
 * data/settings/settings.json and data/packages/packages.json.
 */

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  activation_fee: 50,
  currency_code: 'GHS',
  payment_method: 'MTN Mobile Money',
  payment_number: '024 000 0000',
  account_name: 'Aviator Insights Ltd',
  payment_instructions:
    'Send the exact amount to the number below using the reference shown on your account page. ' +
    'Upload a clear screenshot or photo of the confirmation message so we can verify the payment.',
  support_contact: 'support@aviatorinsights.example',
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  site_name: 'Aviator Insights',
  tagline: 'Live round analytics for the Aviator crash game',
  prediction_cost_gems: 10,
  prediction_cost_coins: 0,
  activation_bonus_gems: 50,
  activation_bonus_coins: 25,
  min_data_points: 20,
  history_window: 120,
  low_balance_threshold: 25,
  max_receipt_bytes: 5 * 1024 * 1024,
  maintenance_mode: false,
  registration_open: true,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const DEFAULT_PACKAGES: CreditPackage[] = [
  {
    id: 'pkg_gems_100',
    name: '100 Gems',
    currency: 'gems',
    credits: 100,
    price: 20,
    currency_code: 'GHS',
    active: true,
    sort_order: 1,
    description: 'Starter bundle',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: 'pkg_gems_250',
    name: '250 Gems',
    currency: 'gems',
    credits: 250,
    price: 40,
    currency_code: 'GHS',
    active: true,
    sort_order: 2,
    description: 'Most popular',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: 'pkg_gems_500',
    name: '500 Gems',
    currency: 'gems',
    credits: 500,
    price: 70,
    currency_code: 'GHS',
    active: true,
    sort_order: 3,
    description: 'Best value',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: 'pkg_gems_1000',
    name: '1000 Gems',
    currency: 'gems',
    credits: 1000,
    price: 120,
    currency_code: 'GHS',
    active: true,
    sort_order: 4,
    description: 'High roller',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: 'pkg_coins_200',
    name: '200 Coins',
    currency: 'coins',
    credits: 200,
    price: 30,
    currency_code: 'GHS',
    active: true,
    sort_order: 5,
    description: 'Secondary credit',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];
