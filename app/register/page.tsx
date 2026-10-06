import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { RegisterForm } from '@/components/RegisterForm';
import { getCurrentUser } from '@/lib/auth/session';
import { getPaymentSettings, getSystemSettings } from '@/lib/settings/settings-service';

/** Per-user data + cookies: always render on demand. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Create Account' };

export default async function RegisterPage() {
  const context = await getCurrentUser();
  if (context) redirect(context.user.role === 'admin' ? '/admin' : '/dashboard');

  const [paymentSettings, systemSettings] = await Promise.all([
    getPaymentSettings(),
    getSystemSettings(),
  ]);

  if (!systemSettings.registration_open) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-white">Registrations are closed</h1>
        <p className="mt-3 text-sm text-slate-400">
          New account creation is currently disabled by the administrator. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="hidden flex-col justify-center lg:flex">
        <span className="badge-info w-fit">
          <ShieldCheck className="h-3 w-3" />
          Two-step onboarding
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white">
          Create your account in a minute.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          Registration creates a <strong className="text-slate-300">pending</strong> account. After
          the one-time activation payment is verified by an administrator, predictions unlock.
        </p>
        <ol className="mt-8 space-y-4 text-sm text-slate-400">
          {[
            'Fill in your details — passwords are hashed with scrypt.',
            `Send the ${paymentSettings.currency_code} ${paymentSettings.activation_fee} activation fee.`,
            'Upload your receipt and wait for manual verification.',
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-500/40 bg-brand-500/10 text-xs font-bold text-brand-300">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-success-400" />
          Accounts are never activated automatically — every payment is reviewed by a human.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="mb-1 font-display text-2xl font-bold text-white">Create Account</h2>
        <p className="mb-6 text-sm text-slate-400">
          All fields are required. Use a valid email — it is your account identity.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
