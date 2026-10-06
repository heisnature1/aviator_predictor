'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { post } from '@/lib/client/api';
import { useToast } from '@/components/ui/Toast';
import type { PublicUser } from '@/types';

export function LoginForm({ demoHint }: { demoHint?: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await post<{ user: PublicUser }>('/api/auth/login', { identifier, password });
      toast.success(`Welcome back, ${result.user.full_name.split(' ')[0]}`);
      const next = params.get('next');
      const destination =
        next && next.startsWith('/') ? next : result.user.role === 'admin' ? '/admin' : '/dashboard';
      router.push(destination);
      router.refresh();
    } catch (caught) {
      const message = (caught as Error).message;
      setError(message);
      toast.error('Sign-in failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="identifier">
          Email or username
        </label>
        <input
          id="identifier"
          className="input"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            className="input pr-11"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
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
            Signing in…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Sign in
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-500">
        New here?{' '}
        <Link href="/register" className="font-semibold text-brand-400 hover:text-brand-300">
          Create an account
        </Link>
      </p>

      {demoHint ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center text-[11px] text-slate-400">
          {demoHint}
        </p>
      ) : null}
    </form>
  );
}
