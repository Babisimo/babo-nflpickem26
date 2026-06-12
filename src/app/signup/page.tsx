'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signup, type SignupState } from '@/app/actions/auth';

export default function SignupPage() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state === undefined) return; // initial
  }, [state]);

  return (
    <form
      action={async (fd) => {
        const result = await signup(undefined, fd);
        if (result === undefined) router.push('/login?registered=1');
      }}
      className="mx-auto max-w-sm space-y-4"
    >
      <h1 className="text-xl font-bold">Create your account</h1>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
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
