'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
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
    if (res?.error) setError('Invalid email or password.');
    else router.push('/picks');
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold">Log in</h1>
      {params.get('registered') && <p className="text-sm text-green-700">Account created — please log in.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input name="email" type="email" placeholder="Email" className="w-full rounded border px-3 py-2" required />
      <input name="password" type="password" placeholder="Password" className="w-full rounded border px-3 py-2" required />
      <button disabled={pending} className="w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50">
        {pending ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-sm text-slate-600">No account? <a href="/signup" className="underline">Sign up</a></p>
    </form>
  );
}
