import { transactionsCollection, walletsCollection } from '@/lib/storage/collections';
import { withStorageTransaction } from '@/lib/storage/database';
import { createLock } from '@/lib/storage/lock';
import { Errors } from '@/lib/http';
import { newId, nowIso } from '@/lib/utils';
import type { TransactionType, Wallet, WalletCurrency, WalletTransaction } from '@/types';

/**
 * Wallet & ledger.
 * ---------------------------------------------------------------------------
 * Invariant enforced here: a balance can NEVER change without a matching
 * transaction row being appended. Both writes happen inside one exclusive
 * lock so the ledger and the balance cannot drift apart.
 *
 * Credits are only ever granted by:
 *   • an administrator approving an activation payment (bonus)
 *   • an administrator approving a credit purchase
 *   • an explicit administrator adjustment
 * Never by a user uploading a receipt.
 */

const walletLock = createLock();

export async function getWallet(userId: string): Promise<Wallet> {
  const wallets = await walletsCollection.read();
  const existing = wallets.find((wallet) => wallet.user_id === userId);
  if (existing) return existing;

  const timestamp = nowIso();
  const created: Wallet = {
    user_id: userId,
    gems: 0,
    coins: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await walletsCollection.mutate((current) =>
    current.some((wallet) => wallet.user_id === userId) ? current : [...current, created],
  );
  return created;
}

export async function getBalances(userId: string): Promise<{ gems: number; coins: number }> {
  const wallet = await getWallet(userId);
  return { gems: wallet.gems, coins: wallet.coins };
}

export interface WalletChangeInput {
  user_id: string;
  currency: WalletCurrency;
  /** Signed: positive credits, negative debits. Must be a whole number. */
  amount: number;
  type: TransactionType;
  reference: string;
  description: string;
  actor_id?: string | null;
  /** Reject debits that would overdraw the wallet (default true). */
  allow_overdraft?: boolean;
}

export interface WalletChangeResult {
  wallet: Wallet;
  transaction: WalletTransaction;
  balance_before: number;
  balance_after: number;
}

export async function applyWalletChange(input: WalletChangeInput): Promise<WalletChangeResult> {
  const amount = Math.trunc(input.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    throw Errors.invalid('A wallet change must be a non-zero whole number.');
  }
  if (!input.user_id) throw Errors.invalid('A wallet change requires a user.');

  return withStorageTransaction(
    () =>
      walletLock.runExclusive(async () => {
        const timestamp = nowIso();
        let updatedWallet: Wallet | undefined;
        let transaction: WalletTransaction | undefined;
        let balanceBefore: number | undefined;
        let balanceAfter: number | undefined;

        await walletsCollection.mutate((wallets) => {
          const existing = wallets.find((item) => item.user_id === input.user_id);
          const wallet: Wallet = existing ?? {
            user_id: input.user_id,
            gems: 0,
            coins: 0,
            created_at: timestamp,
            updated_at: timestamp,
          };

          balanceBefore = wallet[input.currency];
          balanceAfter = balanceBefore + amount;

          if (balanceAfter < 0 && !input.allow_overdraft) {
            throw Errors.invalid(
              `Insufficient ${input.currency}. Your balance is ${balanceBefore.toLocaleString()} ${input.currency}.`,
            );
          }

          updatedWallet = {
            ...wallet,
            [input.currency]: balanceAfter,
            updated_at: timestamp,
          };

          transaction = {
            id: newId('txn'),
            user_id: input.user_id,
            type: input.type,
            currency: input.currency,
            amount,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            reference: input.reference,
            description: input.description,
            created_at: timestamp,
            actor_id: input.actor_id ?? null,
          };

          return existing
            ? wallets.map((item) => (item.user_id === input.user_id ? updatedWallet! : item))
            : [...wallets, updatedWallet];
        });

        if (
          !updatedWallet ||
          !transaction ||
          balanceBefore === undefined ||
          balanceAfter === undefined
        ) {
          throw Errors.server('The wallet change could not be committed.');
        }

        await transactionsCollection.mutate((transactions) => {
          const nextTransactions = [...transactions, transaction!];
          const MAX_TRANSACTIONS = 20_000;
          return nextTransactions.length > MAX_TRANSACTIONS
            ? nextTransactions.slice(nextTransactions.length - MAX_TRANSACTIONS)
            : nextTransactions;
        });

        return { wallet: updatedWallet, transaction, balance_before: balanceBefore, balance_after: balanceAfter };
      }),
    'aviator:wallet-ledger',
  );
}

export async function creditWallet(
  input: Omit<WalletChangeInput, 'amount'> & { amount: number },
): Promise<WalletChangeResult> {
  const amount = Math.abs(Math.trunc(input.amount));
  if (amount <= 0) throw Errors.invalid('Credit amount must be greater than zero.');
  return applyWalletChange({ ...input, amount });
}

export async function debitWallet(
  input: Omit<WalletChangeInput, 'amount'> & { amount: number },
): Promise<WalletChangeResult> {
  const amount = -Math.abs(Math.trunc(input.amount));
  if (amount === 0) throw Errors.invalid('Debit amount must be greater than zero.');
  return applyWalletChange({ ...input, amount });
}

export async function hasSufficientBalance(
  userId: string,
  currency: WalletCurrency,
  amount: number,
): Promise<boolean> {
  const wallet = await getWallet(userId);
  return wallet[currency] >= amount;
}

export async function listTransactions(userId: string, limit = 100): Promise<WalletTransaction[]> {
  const transactions = await transactionsCollection.read();
  return transactions
    .filter((transaction) => transaction.user_id === userId)
    .slice(-limit)
    .reverse();
}

export async function listAllTransactions(limit = 500): Promise<WalletTransaction[]> {
  const transactions = await transactionsCollection.read();
  return transactions.slice(-limit).reverse();
}

export async function walletSummary(): Promise<{
  wallets: Wallet[];
  gemsInCirculation: number;
  coinsInCirculation: number;
  creditsPurchased: number;
}> {
  const wallets = await walletsCollection.read();
  const transactions = await transactionsCollection.read();
  const creditsPurchased = transactions
    .filter((transaction) => transaction.type === 'gem_purchase' || transaction.type === 'coin_purchase')
    .reduce((total, transaction) => total + Math.max(0, transaction.amount), 0);

  return {
    wallets,
    gemsInCirculation: wallets.reduce((total, wallet) => total + wallet.gems, 0),
    coinsInCirculation: wallets.reduce((total, wallet) => total + wallet.coins, 0),
    creditsPurchased,
  };
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  account_activation: 'Account activation',
  gem_purchase: 'Gem purchase',
  coin_purchase: 'Coin purchase',
  prediction_usage: 'Prediction usage',
  admin_adjustment: 'Admin adjustment',
  refund: 'Refund',
};
