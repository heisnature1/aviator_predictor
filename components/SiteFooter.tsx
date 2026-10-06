import Link from 'next/link';
import { Plane } from 'lucide-react';

export function SiteFooter({ siteName, tagline }: { siteName: string; tagline: string }) {
  return (
    <footer className="mt-20 border-t border-white/10 bg-ink-950/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
              <Plane className="h-4 w-4 rotate-45 text-white" />
            </span>
            <span className="font-display text-base font-bold text-white">{siteName}</span>
          </div>
          <p className="mt-3 max-w-md text-sm text-slate-400">{tagline}</p>
          <p className="mt-4 max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
            <strong className="text-slate-300">Responsible use:</strong> this platform provides
            statistical analysis of published round history. It does not predict the future, cannot
            guarantee any outcome, and is not affiliated with any casino or game provider. Never
            stake money you cannot afford to lose.
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Platform</p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <Link href="/live" className="transition hover:text-white">
                Live game
              </Link>
            </li>
            <li>
              <Link href="/predictions" className="transition hover:text-white">
                Predictions
              </Link>
            </li>
            <li>
              <Link href="/how-it-works" className="transition hover:text-white">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/wallet" className="transition hover:text-white">
                Wallet & credits
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account</p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <Link href="/login" className="transition hover:text-white">
                Login
              </Link>
            </li>
            <li>
              <Link href="/register" className="transition hover:text-white">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/payments" className="transition hover:text-white">
                Activation payment
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="transition hover:text-white">
                Dashboard
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-5">
        <p className="mx-auto max-w-7xl text-xs text-slate-500">
          © {new Date().getFullYear()} {siteName}. Analysis only — no outcome is guaranteed. 18+
        </p>
      </div>
    </footer>
  );
}
