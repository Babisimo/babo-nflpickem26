'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signup } from '@/app/actions/auth';

export default function SignupPage() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">Join the league</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Create account
        </h1>

        {error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <form
          action={(fd) => {
            setError(undefined);
            startTransition(async () => {
              const result = await signup(undefined, fd);
              if (result === undefined) {
                router.push('/login?registered=1');
              } else {
                setError(result.error);
              }
            });
          }}
          className="mt-6 space-y-3"
        >
          <input name="name" placeholder="Name" className="field-input" required />
          <input name="email" type="email" placeholder="Email" className="field-input" required />
          <input
            name="password"
            type="password"
            placeholder="Password (min 8 chars)"
            className="field-input"
            required
          />
          <button disabled={pending} className="btn-accent w-full">
            {pending ? 'Creating…' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
          Already have an account?{' '}
          <Link href="/login" className="text-accent underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
