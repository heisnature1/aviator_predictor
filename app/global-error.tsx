'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Last-resort boundary for failures in the root layout itself.
 *
 * This renders instead of the whole app, so it must stay dependency-free and
 * always succeed. We surface a short, user-safe message plus an opaque error
 * digest (when Next.js provides one) that support can correlate with server
 * logs — never a raw stack trace.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[aviator-insights] root layout error', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-white">Unexpected error</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The application could not start this page. Please reload, or contact support if it keeps
            happening.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            If this is on Vercel, check that Supabase is configured: <code>DATABASE_URL</code>,
            <code>SUPABASE_URL</code> and a server-only <code>SUPABASE_SECRET_KEY</code> (or legacy
            <code>SUPABASE_SERVICE_ROLE_KEY</code>) must be available, with <code>STORAGE_MODE=postgres</code>. Local file storage is not
            durable there.
          </p>
          {error.digest ? (
            <p className="mt-3 text-xs text-slate-600">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="btn-primary mt-8"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
