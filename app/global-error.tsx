'use client';

import './globals.css';

/** Last-resort boundary for failures in the root layout itself. */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-white">Unexpected error</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The application could not start this page. Please reload, or contact support if it keeps
            happening.
          </p>
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
