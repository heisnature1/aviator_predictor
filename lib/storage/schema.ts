import { z } from 'zod';

/**
 * Zod schemas for every persisted collection.
 *
 * They are used to validate data *before* it is written (fail loudly) and to
 * detect corrupted files on read (quarantine + rebuild instead of crashing).
 */

const iso = z.string().min(4);
const numeric = z.number().finite();

export const userSchema = z
  .object({
    id: z.string().min(1),
    full_name: z.string(),
    username: z.string(),
    email: z.string(),
    phone: z.string(),
    password_hash: z.string(),
    role: z.enum(['user', 'admin']),
    account_status: z.enum(['pending', 'active', 'rejected', 'suspended']),
    created_at: iso,
    updated_at: iso,
    last_login: iso.nullable(),
  })
  .passthrough();

export const sessionSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    token_hash: z.string().min(16),
    created_at: iso,
    expires_at: iso,
    last_seen_at: iso,
    revoked_at: iso.nullable(),
  })
  .passthrough();

export const walletSchema = z
  .object({
    user_id: z.string().min(1),
    gems: numeric,
    coins: numeric,
    created_at: iso,
    updated_at: iso,
  })
  .passthrough();

export const transactionSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    type: z.enum([
      'account_activation',
      'gem_purchase',
      'coin_purchase',
      'prediction_usage',
      'admin_adjustment',
      'refund',
    ]),
    currency: z.enum(['gems', 'coins']),
    amount: numeric,
    balance_before: numeric,
    balance_after: numeric,
    reference: z.string(),
    description: z.string(),
    created_at: iso,
  })
  .passthrough();

export const packageSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    currency: z.enum(['gems', 'coins']),
    credits: numeric,
    price: numeric,
    currency_code: z.string(),
    active: z.boolean(),
    sort_order: numeric,
    created_at: iso,
    updated_at: iso,
  })
  .passthrough();

export const paymentSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    type: z.enum(['account_activation', 'credit_purchase']),
    amount: numeric,
    payment_method: z.string(),
    reference: z.string(),
    receipt_file: z.string().nullable(),
    status: z.enum(['pending', 'approved', 'rejected']),
    admin_note: z.string().nullable(),
    created_at: iso,
    reviewed_at: iso.nullable(),
    reviewed_by: z.string().nullable(),
  })
  .passthrough();

export const purchaseSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    package_id: z.string().min(1),
    package_name: z.string(),
    currency: z.enum(['gems', 'coins']),
    credits: numeric,
    amount: numeric,
    payment_method: z.string(),
    reference: z.string(),
    receipt_file: z.string().nullable(),
    status: z.enum(['pending', 'approved', 'rejected']),
    admin_note: z.string().nullable(),
    created_at: iso,
    reviewed_at: iso.nullable(),
    reviewed_by: z.string().nullable(),
  })
  .passthrough();

export const predictionSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    status: z.enum(['generated', 'insufficient_data', 'unavailable', 'failed']),
    estimated_min: numeric.nullable(),
    estimated_max: numeric.nullable(),
    confidence: z.enum(['insufficient', 'low', 'moderate', 'high']),
    data_points: numeric,
    created_at: iso,
  })
  .passthrough();

export const notificationSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    kind: z.string(),
    title: z.string(),
    message: z.string(),
    read: z.boolean(),
    created_at: iso,
  })
  .passthrough();

export const paymentSettingsSchema = z
  .object({
    activation_fee: numeric,
    currency_code: z.string(),
    payment_method: z.string(),
    payment_number: z.string(),
    account_name: z.string(),
    payment_instructions: z.string(),
    support_contact: z.string(),
    updated_at: iso,
  })
  .passthrough();

export const systemSettingsSchema = z
  .object({
    site_name: z.string(),
    tagline: z.string(),
    prediction_cost_gems: numeric,
    prediction_cost_coins: numeric,
    activation_bonus_gems: numeric,
    activation_bonus_coins: numeric,
    min_data_points: numeric,
    history_window: numeric,
    low_balance_threshold: numeric,
    max_receipt_bytes: numeric,
    maintenance_mode: z.boolean(),
    registration_open: z.boolean(),
    updated_at: iso,
  })
  .passthrough();

export const settingsSchema = z
  .object({
    payments: paymentSettingsSchema,
    system: systemSettingsSchema,
  })
  .passthrough();

export const auditSchema = z
  .object({
    id: z.string().min(1),
    admin_id: z.string().nullable(),
    action: z.string(),
    target_user: z.string().nullable(),
    previous_value: z.string().nullable(),
    new_value: z.string().nullable(),
    reason: z.string().nullable(),
    timestamp: iso,
  })
  .passthrough();

export type CollectionName =
  | 'users'
  | 'sessions'
  | 'wallets'
  | 'transactions'
  | 'payments'
  | 'purchases'
  | 'predictions'
  | 'notifications'
  | 'settings'
  | 'packages'
  | 'audit';

export const collectionSchemas = {
  users: z.array(userSchema),
  sessions: z.array(sessionSchema),
  wallets: z.array(walletSchema),
  transactions: z.array(transactionSchema),
  payments: z.array(paymentSchema),
  purchases: z.array(purchaseSchema),
  predictions: z.array(predictionSchema),
  notifications: z.array(notificationSchema),
  settings: settingsSchema,
  packages: z.array(packageSchema),
  audit: z.array(auditSchema),
} satisfies Record<CollectionName, z.ZodTypeAny>;
