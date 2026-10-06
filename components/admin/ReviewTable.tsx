'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Receipt, XCircle } from 'lucide-react';
import { post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/Modal';
import { LocalTime } from '@/components/ui/LocalTime';
import { StatusBadge, EmptyState } from '@/components/ui/primitives';
import { formatCurrency, initialsOf } from '@/lib/format';

export interface ReviewRow {
  id: string;
  user: { id: string; full_name: string; email: string; username: string };
  amount: number;
  currency_code: string;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
  has_receipt: boolean;
  /** Credit purchases only */
  package_name?: string;
  credits?: number;
  currency?: 'gems' | 'coins';
}

/**
 * Payment / purchase review table.
 *
 * Approving or rejecting always goes through the admin API, which re-checks the
 * administrator's session and role server-side before touching data.
 */
export function ReviewTable({
  kind,
  rows,
  emptyTitle,
  emptyMessage,
}: {
  kind: 'payment' | 'purchase';
  rows: ReviewRow[];
  emptyTitle: string;
  emptyMessage: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ReviewRow | null>(null);
  const [reason, setReason] = useState('');

  async function approve(row: ReviewRow) {
    setBusyId(row.id);
    try {
      await post(`/api/admin/${kind === 'payment' ? 'payments' : 'purchases'}/${row.id}/approve`, {});
      toast.success(
        kind === 'payment' ? 'Payment approved' : 'Purchase approved',
        kind === 'payment'
          ? 'The account was activated and the activation bonus was credited.'
          : `${row.credits?.toLocaleString()} ${row.currency} were added to the wallet.`,
      );
      router.refresh();
    } catch (error) {
      toast.error('Approval failed', (error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await post(
        `/api/admin/${kind === 'payment' ? 'payments' : 'purchases'}/${rejectTarget.id}/reject`,
        { reason },
      );
      toast.success('Rejected', 'The user was notified with your reason.');
      setRejectTarget(null);
      setReason('');
      router.refresh();
    } catch (error) {
      toast.error('Rejection failed', (error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              {kind === 'purchase' ? <th className="hidden md:table-cell">Package</th> : null}
              <th>Amount</th>
              {kind === 'purchase' ? <th className="hidden sm:table-cell">Credits</th> : null}
              <th className="hidden lg:table-cell">Reference</th>
              <th>Status</th>
              <th className="hidden lg:table-cell">Submitted</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[11px] font-bold text-slate-300">
                      {initialsOf(row.user.full_name)}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users?search=${encodeURIComponent(row.user.email)}`}
                        className="block truncate text-xs font-medium text-white hover:text-brand-300"
                      >
                        {row.user.full_name}
                      </Link>
                      <span className="block truncate text-[11px] text-slate-500">{row.user.email}</span>
                    </div>
                  </div>
                </td>

                {kind === 'purchase' ? (
                  <td className="hidden text-xs text-slate-300 md:table-cell">{row.package_name}</td>
                ) : null}

                <td className="font-semibold text-white tabular">
                  {formatCurrency(row.amount, row.currency_code)}
                </td>

                {kind === 'purchase' ? (
                  <td className="hidden text-xs text-slate-300 tabular sm:table-cell">
                    {row.credits?.toLocaleString()} {row.currency}
                  </td>
                ) : null}

                <td className="hidden font-mono text-[11px] text-slate-400 lg:table-cell">
                  {row.reference}
                </td>

                <td>
                  <StatusBadge status={row.status} />
                  {row.status === 'rejected' && row.admin_note ? (
                    <span className="block max-w-[200px] truncate text-[11px] text-slate-500">
                      {row.admin_note}
                    </span>
                  ) : null}
                </td>

                <td className="hidden text-xs text-slate-400 lg:table-cell">
                  <LocalTime iso={row.created_at} mode="datetime" />
                </td>

                <td>
                  <div className="flex items-center justify-end gap-1.5">
                    {row.has_receipt ? (
                      <a
                        href={`/api/receipts/${kind}/${row.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-white/25 hover:text-white"
                        title="View receipt"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </a>
                    ) : null}

                    <Link
                      href={`/admin/users?search=${encodeURIComponent(row.user.email)}`}
                      className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-white/25 hover:text-white"
                      title="View user"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>

                    {row.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => approve(row)}
                          disabled={busyId === row.id}
                          className="btn-success btn-sm"
                          title="Approve"
                        >
                          {busyId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTarget(row);
                            setReason('');
                          }}
                          disabled={busyId === row.id}
                          className="btn-danger btn-sm"
                          title="Reject"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        {row.reviewed_at ? <LocalTime iso={row.reviewed_at} mode="relative" /> : '—'}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={confirmReject}
        title={kind === 'payment' ? 'Reject activation payment' : 'Reject credit purchase'}
        description="The reason is stored in the audit log and shown to the user."
        confirmLabel="Reject"
        variant="danger"
        loading={busyId !== null}
      >
        {rejectTarget ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              <p className="text-white">
                {rejectTarget.user.full_name} · {formatCurrency(rejectTarget.amount, rejectTarget.currency_code)}
              </p>
              <p className="mt-0.5 text-slate-400">Reference {rejectTarget.reference}</p>
            </div>
            <div>
              <label className="label" htmlFor="reject-reason">
                Rejection reason
              </label>
              <textarea
                id="reject-reason"
                className="input min-h-[90px]"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. The receipt does not match the payment amount."
              />
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
