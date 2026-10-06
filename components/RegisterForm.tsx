'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import { Callout } from '@/components/ui/primitives';

interface FieldErrors {
  full_name?: string;
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm_password?: string;
}

const RULES = [
  { label: '8+ characters', test: (value: string) => value.length >= 8 },
  { label: 'Upper & lower case', test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'A number', test: (value: string) => /[0-9]/.test(value) },
];

export function RegisterForm() {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setErrors({});

    try {
      await post('/api/auth/register', values);
      setCreated(true);
      toast.success('Account created', 'Complete the activation payment to unlock predictions.');
      router.refresh();
    } catch (caught) {
      const apiError = caught as { message?: string; fields?: FieldErrors };
      setError(apiError.message ?? 'The account could not be created.');
      if (apiError.fields) setErrors(apiError.fields);
      toast.error('Registration failed', apiError.message);
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <Callout tone="warning" title="Account status: Pending Activation">
          Your account was created and is waiting for activation. Complete the required activation
          payment and submit your receipt — an administrator will review it manually.
        </Callout>
        <div className="grid gap-2">
          <Link href="/payments" className="btn-primary w-full">
            View payment instructions
          </Link>
          <Link href="/dashboard" className="btn-secondary w-full">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="full_name"
          label="Full name"
          value={values.full_name}
          onChange={(value) => update('full_name', value)}
          error={errors.full_name}
          autoComplete="name"
          placeholder="John Doe"
        />
        <Field
          id="username"
          label="Username"
          value={values.username}
          onChange={(value) => update('username', value)}
          error={errors.username}
          autoComplete="username"
          placeholder="johndoe"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="email"
          label="Email"
          type="email"
          value={values.email}
          onChange={(value) => update('email', value)}
          error={errors.email}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Field
          id="phone"
          label="Phone number"
          type="tel"
          value={values.phone}
          onChange={(value) => update('phone', value)}
          error={errors.phone}
          autoComplete="tel"
          placeholder="+233 24 000 0000"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              className="input pr-11"
              type={showPassword ? 'text' : 'password'}
              value={values.password}
              onChange={(event) => update('password', event.target.value)}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:text-slate-300"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? (
            <p className="mt-1.5 text-xs text-danger-400">{errors.password}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {RULES.map((rule) => {
                const passed = rule.test(values.password);
                return (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-[11px] ${
                      passed ? 'text-success-400' : 'text-slate-500'
                    }`}
                  >
                    <Check className={`h-3 w-3 ${passed ? '' : 'opacity-40'}`} />
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Field
          id="confirm_password"
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          value={values.confirm_password}
          onChange={(value) => update('confirm_password', value)}
          error={errors.confirm_password}
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-danger-500/25 bg-danger-500/10 px-3 py-2.5 text-xs text-danger-300">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating account…
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            Create Account
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-500">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-brand-400 hover:text-brand-300">
          Sign in
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      {error ? <p className="mt-1.5 text-xs text-danger-400">{error}</p> : null}
    </div>
  );
}
