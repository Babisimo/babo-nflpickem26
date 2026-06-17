'use client';

import { Suspense, useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPassword, type ResetPasswordState } from '@/app/actions/password-reset';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    undefined,
  );

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">Almost there</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Reset password
        </h1>

        {!token ? (
          <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            This reset link is missing its token. Request a new one from the{' '}
            <Link href="/forgot-password" className="underline underline-offset-4">
              forgot-password
            </Link>{' '}
            page.
          </p>
        ) : state?.ok ? (
          <p className="mt-6 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 text-sm text-accent">
            Your password has been updated.{' '}
            <Link href="/login" className="underline underline-offset-4">
              Log in
            </Link>
            .
          </p>
        ) : (
          <>
            {state?.error && (
              <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {state.error}
              </p>
            )}
            <form action={formAction} className="mt-6 space-y-3">
              <input type="hidden" name="token" value={token} />
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
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
