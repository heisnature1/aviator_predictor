import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { LoginForm } from '@/components/LoginForm';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Login' };

export default async function LoginPage() {
  const context = await getCurrentUser();
  if (context) redirect(context.user.role === 'admin' ? '/admin' : '/dashboard');

  const demoHint =
    process.env.DEMO_SEED === 'true'
      ? 'Demo accounts: admin@aviatorinsights.test / Admin#12345 · john@example.com / User#12345'
      : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="hidden flex-col justify-center lg:flex">
        <span className="badge-info w-fit">
          <ShieldCheck className="h-3 w-3" />
          Secure account area
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white">
          Welcome back to your round analytics desk.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          Sign in to request analyses, manage your wallet, review your prediction history and track
          the status of your payments.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-slate-400">
          {[
            'Server-side prediction generation',
            'Full wallet & transaction history',
            'Payment receipts verified by an administrator',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="mb-1 font-display text-2xl font-bold text-white">Sign in</h2>
        <p className="mb-6 text-sm text-slate-400">
          Use your email or username. Sessions expire automatically.
        </p>
        <Suspense fallback={null}>
          <LoginForm demoHint={demoHint} />
        </Suspense>
        <p className="mt-6 text-center text-xs text-slate-500">
          By signing in you agree to use the platform responsibly.{' '}
          <Link href="/how-it-works" className="text-slate-400 underline-offset-2 hover:underline">
            Learn how it works
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
