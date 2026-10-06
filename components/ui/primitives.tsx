import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import type { AccountStatus, PaymentStatus } from '@/types';

/** Small presentational primitives shared across the app. */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'warning' | 'success' | 'danger' | 'info';
}) {
  const tones: Record<string, string> = {
    default: 'from-white/5 to-transparent',
    warning: 'from-coin-500/15 to-transparent',
    success: 'from-success-500/15 to-transparent',
    danger: 'from-danger-500/15 to-transparent',
    info: 'from-accent-500/15 to-transparent',
  };

  return (
    <div className="card relative overflow-hidden p-5">
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone]} opacity-80`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-white">{value}</p>
          {hint ? <p className="mt-1.5 text-xs text-slate-400">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300">{icon}</div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {message ? <p className="mt-1 max-w-md text-xs text-slate-400">{message}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block ${className} animate-spin rounded-full border-2 border-white/20 border-t-white/80`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function StatusBadge({ status }: { status: AccountStatus | PaymentStatus }) {
  const map: Record<string, { className: string; label: string }> = {
    active: { className: 'badge-success', label: 'Active' },
    approved: { className: 'badge-success', label: 'Approved' },
    pending: { className: 'badge-warning', label: 'Pending' },
    rejected: { className: 'badge-danger', label: 'Rejected' },
    suspended: { className: 'badge-danger', label: 'Suspended' },
  };
  const entry = map[status] ?? { className: 'badge-muted', label: status };
  return (
    <span className={entry.className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {entry.label}
    </span>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
  icon,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    info: 'border-accent-400/30 bg-accent-500/10 text-accent-200',
    warning: 'border-coin-400/30 bg-coin-500/10 text-coin-200',
    danger: 'border-danger-500/30 bg-danger-500/10 text-danger-200',
    success: 'border-success-500/30 bg-success-500/10 text-success-200',
  };
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        <div className="text-xs leading-relaxed text-slate-300">{children}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-300">{children}</h2>
      {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
