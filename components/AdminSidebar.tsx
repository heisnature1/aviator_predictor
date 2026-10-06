'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BadgeDollarSign,
  CreditCard,
  Gem,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof Users;
  badge?: number;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/pending-accounts', label: 'Pending Accounts', icon: ShieldCheck },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/purchases', label: 'Credit Purchases', icon: BadgeDollarSign },
  { href: '/admin/predictions', label: 'Predictions', icon: Sparkles },
  { href: '/admin/wallets', label: 'Wallets', icon: Wallet },
  { href: '/admin/packages', label: 'Packages', icon: Package },
  { href: '/admin/settings/payments', label: 'Payment Settings', icon: Settings },
  { href: '/admin/settings', label: 'System Settings', icon: Settings },
  { href: '/admin/admins', label: 'Admin Users', icon: ShieldCheck },
  { href: '/admin/audit', label: 'Activity Logs', icon: Activity },
  { href: '/admin/gems', label: 'Credit Overview', icon: Gem },
];

export function AdminSidebar({ badges = {} }: { badges?: Record<string, number> }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <nav className="sticky top-20 space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const badge = badges[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'border border-brand-500/30 bg-brand-500/10 text-white'
                    : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {badge ? (
                  <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile / tablet: horizontally scrollable tab bar */}
      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-2 no-scrollbar lg:hidden">
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const badge = badges[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'border-brand-500/40 bg-brand-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {badge ? (
                <span className="rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
