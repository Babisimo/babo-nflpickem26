'use client';

import { useActionState } from 'react';
import { changePassword, type ChangePasswordState } from '@/app/actions/auth';

export default function AccountPage() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined,
  );

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Change password
        </h1>

        {state?.ok && (
          <p className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-accent">
            Password updated
          </p>
        )}
        {state?.error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <form action={formAction} className="mt-6 space-y-3">
          <input
            name="currentPassword"
            type="password"
            placeholder="Current password"
            className="field-input"
            required
          />
          <input
            name="newPassword"
            type="password"
            placeholder="New password (min 8 chars)"
            className="field-input"
            required
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            className="field-input"
            required
          />
          <button disabled={pending} className="btn-accent w-full">
            {pending ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
