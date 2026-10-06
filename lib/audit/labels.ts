import type { AuditAction } from '@/types';

/**
 * Human readable audit action labels.
 * Client-safe module (no Node imports) so admin tables can render them.
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  admin_login: 'Admin signed in',
  admin_approved_payment: 'Approved activation payment',
  admin_rejected_payment: 'Rejected activation payment',
  admin_approved_purchase: 'Approved credit purchase',
  admin_rejected_purchase: 'Rejected credit purchase',
  admin_activated_account: 'Activated account',
  admin_rejected_account: 'Rejected account',
  admin_suspended_account: 'Suspended account',
  admin_changed_role: 'Changed user role',
  admin_added_credits: 'Added credits',
  admin_removed_credits: 'Removed credits',
  admin_changed_package: 'Changed credit package',
  admin_created_package: 'Created credit package',
  admin_deleted_package: 'Deleted credit package',
  admin_changed_payment_settings: 'Changed payment settings',
  admin_changed_system_settings: 'Changed system settings',
  user_registered: 'User registered',
  user_login: 'User signed in',
  payment_submitted: 'Activation payment submitted',
  purchase_submitted: 'Credit purchase submitted',
  prediction_generated: 'Prediction generated',
  system: 'System event',
};
