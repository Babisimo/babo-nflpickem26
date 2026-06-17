'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError('Invalid email or password.');
    } else {
      // Navigate, then refresh so the server-rendered root layout (header)
      // re-reads the new session and shows the account name / Admin link.
      router.push('/picks');
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">Log in</h1>

        {params.get('registered') && (
          <p className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-accent">
            Account created &mdash; please log in
          </p>
        )}
        {error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input name="email" type="email" placeholder="Email" className="field-input" required />
          <input name="password" type="password" placeholder="Password" className="field-input" required />
          <button disabled={pending} className="btn-accent w-full">
            {pending ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-right">
          <Link
            href="/forgot-password"
            className="font-mono text-[12px] uppercase tracking-[0.1em] text-accent underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </p>

        <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
          No account?{' '}
          <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
