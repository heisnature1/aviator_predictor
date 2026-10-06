import type {
  AuditEntry,
  CreditPackage,
  Notification,
  Payment,
  Prediction,
  Purchase,
  Session,
  SettingsBundle,
  User,
  Wallet,
  WalletTransaction,
} from '@/types';
import { mutateCollection, readCollection, writeCollection, type CollectionName } from './database';

/**
 * Typed collection accessors.
 *
 * Domain modules (lib/users, lib/wallet, lib/payments, ...) use these helpers
 * instead of touching the filesystem — that keeps the storage implementation
 * swappable and enforces schema validation on every access.
 */

function createCollection<T>(name: CollectionName) {
  return {
    name,
    read: () => readCollection<T>(name),
    write: (value: T) => writeCollection<T>(name, value),
    mutate: (mutator: (current: T) => T | Promise<T>) => mutateCollection<T>(name, mutator),
  };
}

export const usersCollection = createCollection<User[]>('users');
export const sessionsCollection = createCollection<Session[]>('sessions');
export const walletsCollection = createCollection<Wallet[]>('wallets');
export const transactionsCollection = createCollection<WalletTransaction[]>('transactions');
export const paymentsCollection = createCollection<Payment[]>('payments');
export const purchasesCollection = createCollection<Purchase[]>('purchases');
export const predictionsCollection = createCollection<Prediction[]>('predictions');
export const notificationsCollection = createCollection<Notification[]>('notifications');
export const settingsCollection = createCollection<SettingsBundle>('settings');
export const packagesCollection = createCollection<CreditPackage[]>('packages');
export const auditCollection = createCollection<AuditEntry[]>('audit');
