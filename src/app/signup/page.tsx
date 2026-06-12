'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signup } from '@/app/actions/auth';

export default function SignupPage() {
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
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
      className="mx-auto max-w-sm space-y-4"
    >
      <h1 className="text-xl font-bold">Create your account</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input name="name" placeholder="Name" className="w-full rounded border px-3 py-2" required />
      <input name="email" type="email" placeholder="Email" className="w-full rounded border px-3 py-2" required />
      <input name="password" type="password" placeholder="Password (min 8 chars)" className="w-full rounded border px-3 py-2" required />
      <button disabled={pending} className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50">
        {pending ? 'Creating…' : 'Sign up'}
      </button>
      <p className="text-sm text-slate-600">Already have an account? <a href="/login" className="underline">Log in</a></p>
    </form>
  );
}
