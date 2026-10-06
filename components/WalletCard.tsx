'use client';

import Link from 'next/link';
import { Coins, Gem, Sparkles, TrendingDown, Wallet as WalletIcon } from 'lucide-react';

export function WalletCard({
  gems,
  coins,
  lowBalanceThreshold = 25,
  showActions = true,
}: {
  gems: number;
  coins: number;
  lowBalanceThreshold?: number;
  showActions?: boolean;
}) {
  const low = gems < lowBalanceThreshold;

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/15 text-accent-300">
            <WalletIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Wallet</h2>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Credits balance</p>
          </div>
        </div>
        {low ? (
          <span className="badge-warning">
            <TrendingDown className="h-3 w-3" />
            Low balance
          </span>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 px-5 py-5">
        <div className="rounded-2xl border border-gem-500/25 bg-gradient-to-br from-gem-500/15 to-transparent p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gem-300">
            <Gem className="h-3.5 w-3.5" />
            Gems
          </p>
          <p className="mt-1.5 font-display text-3xl font-bold tabular text-white">
            {gems.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-coin-400/25 bg-gradient-to-br from-coin-500/15 to-transparent p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-coin-300">
            <Coins className="h-3.5 w-3.5" />
            Coins
          </p>
          <p className="mt-1.5 font-display text-3xl font-bold tabular text-white">
            {coins.toLocaleString()}
          </p>
        </div>
      </div>

      {showActions ? (
        <div className="grid grid-cols-2 gap-2 px-5 pb-5">
          <Link href="/wallet?tab=buy" className="btn-secondary btn-sm">
            Buy Gems
          </Link>
          <Link href="/wallet?tab=buy" className="btn-secondary btn-sm">
            Buy Coins
          </Link>
          <Link href="/predictions" className="btn-primary col-span-2">
            <Sparkles className="h-4 w-4" />
            Make Prediction
          </Link>
        </div>
      ) : null}
    </section>
  );
}
