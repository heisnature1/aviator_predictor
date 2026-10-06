'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Gem, Loader2, Search, Shield, ShieldOff, Wallet } from 'lucide-react';
import { post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusBadge } from '@/components/ui/primitives';
import type { AccountStatus } from '@/types';

export interface ManagedUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  role: 'user' | 'admin';
  account_status: AccountStatus;
  created_at: string;
  last_login: string | null;
  gems: number;
  coins: number;
}

const STATUSES: AccountStatus[] = ['active', 'pending', 'suspended', 'rejected'];

/**
 * User management table: search, filter, status changes, wallet adjustments
 * and role management. Every action is an audited admin API call.
 */
export function UserManager({ users, currentUserId }: { users: ManagedUser[]; currentUserId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [walletTarget, setWalletTarget] = useState<ManagedUser | null>(null);
  const [adjustment, setAdjustment] = useState({ currency: 'gems', amount: '', reason: '' });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== 'all' && user.account_status !== statusFilter) return false;
      if (!needle) return true;
      return (
        user.full_name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle) ||
        user.phone.toLowerCase().includes(needle)
      );
    });
  }, [users, search, statusFilter]);

  async function setStatus(user: ManagedUser, status: AccountStatus, reason?: string) {
    setBusyId(user.id);
    try {
      await post(`/api/admin/users/${user.id}/status`, { status, reason: reason ?? null });
      toast.success('Account updated', `${user.full_name} is now ${status}.`);
      router.refresh();
    } catch (error) {
      toast.error('Update failed', (error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRole(user: ManagedUser) {
    setBusyId(user.id);
    try {
      await post(`/api/admin/users/${user.id}/role`, { role: user.role === 'admin' ? 'user' : 'admin' });
      toast.success('Role updated', `${user.full_name} is now ${user.role === 'admin' ? 'user' : 'admin'}.`);
      router.refresh();
    } catch (error) {
      toast.error('Update failed', (error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function submitAdjustment() {
    if (!walletTarget) return;
    const amount = Number(adjustment.amount);
    if (!Number.isFinite(amount) || Math.trunc(amount) === 0) {
      toast.error('Invalid amount', 'Enter a whole number of credits (use a minus sign to remove).');
      return;
    }
    if (adjustment.reason.trim().length < 3) {
      toast.error('Reason required', 'Every manual adjustment needs a reason for the audit log.');
      return;
    }

    setBusyId(walletTarget.id);
    try {
      const result = await post<{ balance_after: number }>(`/api/admin/users/${walletTarget.id}/wallet`, {
        currency: adjustment.currency,
        amount: Math.trunc(amount),
        reason: adjustment.reason.trim(),
      });
      toast.success(
        'Wallet adjusted',
        `New ${adjustment.currency} balance: ${result.balance_after.toLocaleString()}`,
      );
      setWalletTarget(null);
      setAdjustment({ currency: 'gems', amount: '', reason: '' });
      router.refresh();
    } catch (error) {
      toast.error('Adjustment failed', (error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search name, email, username or phone…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['all', ...STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === status
                  ? 'border-brand-500/40 bg-brand-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-400">
          No users match those filters.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th className="hidden md:table-cell">Wallet</th>
                <th className="hidden lg:table-cell">Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-white">
                        {user.full_name}
                        {user.role === 'admin' ? (
                          <span className="badge-info">
                            <Shield className="h-3 w-3" />
                            admin
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {user.email} · @{user.username}
                      </p>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={user.account_status} />
                  </td>
                  <td className="hidden text-xs tabular text-slate-300 md:table-cell">
                    <span className="text-gem-300">{user.gems.toLocaleString()} gems</span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="text-coin-300">{user.coins.toLocaleString()} coins</span>
                  </td>
                  <td className="hidden text-xs text-slate-400 md:table-cell">
                    <LocalTime iso={user.created_at} mode="date" />
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => setWalletTarget(user)}
                        disabled={busyId === user.id}
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        Wallet
                      </button>

                      {user.account_status !== 'active' ? (
                        <button
                          type="button"
                          className="btn-success btn-sm"
                          onClick={() => setStatus(user, 'active', 'Activated by administrator')}
                          disabled={busyId === user.id}
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => setStatus(user, 'suspended', 'Suspended by administrator')}
                          disabled={busyId === user.id || user.id === currentUserId}
                        >
                          Suspend
                        </button>
                      )}

                      {user.id !== currentUserId ? (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => toggleRole(user)}
                          disabled={busyId === user.id}
                          title={user.role === 'admin' ? 'Remove admin role' : 'Grant admin role'}
                        >
                          {user.role === 'admin' ? (
                            <ShieldOff className="h-3.5 w-3.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : null}

                      <Link href={`/admin/wallets?user=${user.id}`} className="btn-ghost btn-sm">
                        <Gem className="h-3.5 w-3.5" />
                        Ledger
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Showing {filtered.length} of {users.length} users. Every action is written to the audit log.
      </p>

      <Modal
        open={Boolean(walletTarget)}
        onClose={() => setWalletTarget(null)}
        title="Wallet adjustment"
        description={walletTarget ? `${walletTarget.full_name} · ${walletTarget.email}` : undefined}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setWalletTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submitAdjustment}
              disabled={busyId !== null}
            >
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm adjustment
            </button>
          </>
        }
      >
        {walletTarget ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              <div>
                <p className="text-slate-500">Gems</p>
                <p className="font-semibold text-white tabular">{walletTarget.gems.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Coins</p>
                <p className="font-semibold text-white tabular">{walletTarget.coins.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="adjust-currency">
                  Currency
                </label>
                <select
                  id="adjust-currency"
                  className="input"
                  value={adjustment.currency}
                  onChange={(event) =>
                    setAdjustment((current) => ({ ...current, currency: event.target.value }))
                  }
                >
                  <option value="gems">Gems</option>
                  <option value="coins">Coins</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="adjust-amount">
                  Amount (+ add / − remove)
                </label>
                <input
                  id="adjust-amount"
                  className="input"
                  inputMode="numeric"
                  placeholder="100 or -50"
                  value={adjustment.amount}
                  onChange={(event) =>
                    setAdjustment((current) => ({ ...current, amount: event.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="adjust-reason">
                Reason
              </label>
              <input
                id="adjust-reason"
                className="input"
                placeholder="e.g. Customer compensation"
                value={adjustment.reason}
                onChange={(event) =>
                  setAdjustment((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </div>

            <p className="text-[11px] text-slate-500">
              The adjustment is applied immediately, recorded as an{' '}
              <strong>admin_adjustment</strong> transaction and written to the audit log with your
              administrator id and this reason.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
