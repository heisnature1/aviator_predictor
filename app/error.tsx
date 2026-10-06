'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Route-level error boundary.
 *
 * Shows a short, user-safe message and a recovery action. Details are only
 * written to the browser console — never to the page, and never the raw
 * stack trace or filesystem paths that production builds strip anyway.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[aviator-insights] page error', error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <AlertTriangle className="h-6 w-6 text-amber-300" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold text-white">Something went wrong</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        We could not load this page. Your account data is safe — please try again. If the problem
        persists, contact support.
      </p>
      {error.digest ? (
        <p className="mt-3 text-xs text-slate-600">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Back to home
        </Link>
      </div>
    </div>
  );
}
