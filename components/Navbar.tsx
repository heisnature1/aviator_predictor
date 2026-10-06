'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  Gem,
  LayoutDashboard,
  LogOut,
  Menu,
  Plane,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import { initialsOf } from '@/lib/format';
import type { PublicUser } from '@/types';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/live', label: 'Live Game' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/how-it-works', label: 'How It Works' },
];

export function Navbar({
  user,
  unread,
  siteName,
}: {
  user: PublicUser | null;
  unread: number;
  siteName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  async function signOut() {
    try {
      await post('/api/auth/logout');
      toast.success('Signed out', 'See you next time.');
      router.refresh();
      router.push('/');
    } catch (error) {
      toast.error('Could not sign out', (error as Error).message);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow-sm">
              <Plane className="h-4 w-4 rotate-45 text-white" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-white">
              {siteName}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(link.href)
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
              >
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                ) : null}
              </Link>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-2.5 transition hover:border-white/20 hover:bg-white/10"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-gem-500 text-[11px] font-bold text-white">
                    {initialsOf(user.full_name)}
                  </span>
                  <span className="hidden text-sm font-medium text-white sm:block">
                    {user.full_name.split(' ')[0]}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 mt-2 w-60 animate-fade-in overflow-hidden rounded-xl border border-white/10 bg-ink-850/95 shadow-card backdrop-blur-xl">
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-white">{user.full_name}</p>
                      <p className="truncate text-xs text-slate-400">{user.email}</p>
                      <span
                        className={`mt-2 inline-flex ${
                          user.account_status === 'active' ? 'badge-success' : 'badge-warning'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {user.account_status}
                      </span>
                    </div>
                    <div className="p-1.5">
                      <MenuLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
                        Dashboard
                      </MenuLink>
                      <MenuLink href="/wallet" icon={<Wallet className="h-4 w-4" />}>
                        Wallet
                      </MenuLink>
                      <MenuLink href="/predictions" icon={<Gem className="h-4 w-4" />}>
                        Predictions
                      </MenuLink>
                      <MenuLink href="/payments" icon={<ShieldCheck className="h-4 w-4" />}>
                        Activation
                      </MenuLink>
                      {user.role === 'admin' ? (
                        <MenuLink href="/admin" icon={<ShieldCheck className="h-4 w-4" />}>
                          Admin dashboard
                        </MenuLink>
                      ) : null}
                    </div>
                    <div className="border-t border-white/10 p-1.5">
                      <button
                        type="button"
                        onClick={signOut}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger-400 transition hover:bg-danger-500/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn-ghost btn-sm">
                Login
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                Create Account
              </Link>
            </div>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/5 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/10 bg-ink-900/95 px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive(link.href) ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/dashboard" className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">
                  Dashboard
                </Link>
                <Link href="/wallet" className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">
                  Wallet
                </Link>
                {user.role === 'admin' ? (
                  <Link href="/admin" className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">
                    Admin dashboard
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={signOut}
                  className="mt-1 rounded-lg px-3 py-2.5 text-left text-sm text-danger-400 hover:bg-danger-500/10"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login" className="btn-secondary btn-sm">
                  Login
                </Link>
                <Link href="/register" className="btn-primary btn-sm">
                  Create Account
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
    >
      {icon}
      {children}
    </Link>
  );
}
