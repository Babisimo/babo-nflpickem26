'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { completeProfile, type CompleteProfileState } from '@/app/actions/auth';

export function CompleteProfileForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CompleteProfileState, FormData>(
    completeProfile,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push('/picks');
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">One more step</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Complete your profile
        </h1>
        <p className="mt-4 text-sm text-muted">
          Pick a username and tell us your name so others can see who&rsquo;s who.
        </p>

        {state?.error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-3">
          <input name="username" placeholder="Username" className="field-input" required />
          <div className="flex gap-3">
            <input name="firstName" placeholder="First name" className="field-input" required />
            <input name="lastName" placeholder="Last name" className="field-input" required />
          </div>
          <button disabled={pending} className="btn-accent w-full">
            {pending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
