/**
 * Domain types for the Aviator insights platform.
 *
 * Everything the application persists lives in `data/**` (see lib/storage).
 * These types are the single source of truth shared by server modules, API
 * route handlers and React components.
 */

// ---------------------------------------------------------------------------
// Users & authentication
// ---------------------------------------------------------------------------

export type UserRole = 'user' | 'admin';

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export interface User {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  password_hash: string;
  role: UserRole;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  /** Id of the payment that activated the account (audit trail). */
  activated_by_payment_id?: string | null;
  /** Admin note attached to the last status change. */
  status_note?: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;
}

/** A user record that is safe to send to the browser. Never contains secrets. */
export type PublicUser = Omit<User, 'password_hash' | 'failed_login_attempts' | 'locked_until'>;

export interface Session {
  id: string;
  user_id: string;
  /** SHA-256 of the opaque cookie token — the raw token is never stored. */
  token_hash: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export type WalletCurrency = 'gems' | 'coins';

export interface Wallet {
  user_id: string;
  gems: number;
  coins: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType =
  | 'account_activation'
  | 'gem_purchase'
  | 'coin_purchase'
  | 'prediction_usage'
  | 'admin_adjustment'
  | 'refund';

export interface WalletTransaction {
  id: string;
  user_id: string;
  type: TransactionType;
  currency: WalletCurrency;
  /** Signed amount: positive = credit, negative = debit. */
  amount: number;
  balance_before: number;
  balance_after: number;
  reference: string;
  description: string;
  created_at: string;
  /** Admin user id when the change was performed by an administrator. */
  actor_id?: string | null;
}

// ---------------------------------------------------------------------------
// Packages (credit bundles)
// ---------------------------------------------------------------------------

export interface CreditPackage {
  id: string;
  name: string;
  currency: WalletCurrency;
  credits: number;
  price: number;
  currency_code: string;
  active: boolean;
  sort_order: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Payments & purchases
// ---------------------------------------------------------------------------

export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export type PaymentType = 'account_activation' | 'credit_purchase';

export interface Payment {
  id: string;
  user_id: string;
  type: PaymentType;
  amount: number;
  currency_code: string;
  payment_method: string;
  reference: string;
  receipt_file: string | null;
  receipt_name: string | null;
  status: PaymentStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason?: string | null;
}

export interface Purchase {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  currency: WalletCurrency;
  credits: number;
  amount: number;
  currency_code: string;
  payment_method: string;
  reference: string;
  receipt_file: string | null;
  receipt_name: string | null;
  status: PaymentStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason?: string | null;
}

// ---------------------------------------------------------------------------
// Predictions
// ---------------------------------------------------------------------------

export type PredictionStatus = 'generated' | 'insufficient_data' | 'unavailable' | 'failed';

export type PredictionConfidence = 'insufficient' | 'low' | 'moderate' | 'high';

export interface PredictionAnalysisPoint {
  label: string;
  value: string;
  note?: string;
}

export interface Prediction {
  id: string;
  user_id: string;
  status: PredictionStatus;
  /** Estimated multiplier band — an analysis output, never an official result. */
  estimated_min: number | null;
  estimated_max: number | null;
  confidence: PredictionConfidence;
  analysis: PredictionAnalysisPoint[];
  summary: string;
  data_points: number;
  data_source: 'live_provider' | 'simulation';
  provider: string;
  snapshot_at: string | null;
  round_id: string | null;
  cost_gems: number;
  cost_coins: number;
  engine_version: string;
  disclaimer: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'account_registered'
  | 'payment_submitted'
  | 'account_approved'
  | 'account_rejected'
  | 'purchase_submitted'
  | 'purchase_approved'
  | 'purchase_rejected'
  | 'prediction_generated'
  | 'low_balance'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  link?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface PaymentSettings {
  activation_fee: number;
  currency_code: string;
  payment_method: string;
  payment_number: string;
  account_name: string;
  payment_instructions: string;
  support_contact: string;
  updated_at: string;
  updated_by: string | null;
}

export interface SystemSettings {
  site_name: string;
  tagline: string;
  prediction_cost_gems: number;
  prediction_cost_coins: number;
  activation_bonus_gems: number;
  activation_bonus_coins: number;
  min_data_points: number;
  history_window: number;
  low_balance_threshold: number;
  max_receipt_bytes: number;
  maintenance_mode: boolean;
  registration_open: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface SettingsBundle {
  payments: PaymentSettings;
  system: SystemSettings;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'admin_login'
  | 'admin_approved_payment'
  | 'admin_rejected_payment'
  | 'admin_approved_purchase'
  | 'admin_rejected_purchase'
  | 'admin_activated_account'
  | 'admin_rejected_account'
  | 'admin_suspended_account'
  | 'admin_changed_role'
  | 'admin_added_credits'
  | 'admin_removed_credits'
  | 'admin_changed_package'
  | 'admin_created_package'
  | 'admin_deleted_package'
  | 'admin_changed_payment_settings'
  | 'admin_changed_system_settings'
  | 'user_registered'
  | 'user_login'
  | 'payment_submitted'
  | 'purchase_submitted'
  | 'prediction_generated'
  | 'system';

export interface AuditEntry {
  id: string;
  admin_id: string | null;
  action: AuditAction;
  target_user: string | null;
  target_label: string | null;
  previous_value: string | null;
  new_value: string | null;
  reason: string | null;
  timestamp: string;
  ip_address: string | null;
}

// ---------------------------------------------------------------------------
// Aviator live feed
// ---------------------------------------------------------------------------

export type AviatorRoundStatus = 'waiting' | 'betting' | 'flying' | 'crashed' | 'unknown';

export type AviatorConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'not_configured'
  | 'error';

/** `live` = authorised provider data, `simulation` = local demo stream. */
export type AviatorFeedMode = 'live' | 'simulation' | 'unavailable';

export interface AviatorRound {
  round_id: string;
  multiplier: number | null;
  status: AviatorRoundStatus;
  started_at: string | null;
  ended_at: string | null;
}

export interface AviatorSnapshot {
  provider: string;
  mode: AviatorFeedMode;
  /** True when the numbers are NOT official game data (local simulation). */
  is_simulated: boolean;
  connection: AviatorConnectionStatus;
  current_round_id: string | null;
  current_multiplier: number | null;
  current_status: AviatorRoundStatus;
  round_started_at: string | null;
  history: AviatorRound[];
  updated_at: string;
  fetched_at: string;
  recent_multipliers: number[];
  message: string | null;
}

// ---------------------------------------------------------------------------
// API envelope
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
