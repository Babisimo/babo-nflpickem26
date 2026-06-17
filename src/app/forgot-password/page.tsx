'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, type RequestResetState } from '@/app/actions/password-reset';

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<RequestResetState, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <div className="mx-auto max-w-sm">
      <div className="reveal card p-8">
        <p className="eyebrow">Locked out?</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Forgot password
        </h1>

        {state?.sent ? (
          <p className="mt-6 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 text-sm text-accent">
            If an account exists for that email, a reset link is on its way. Check your inbox —
            the link expires in 1 hour.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted">
              Enter your email and we&rsquo;ll send you a link to reset your password.
            </p>
            <form action={formAction} className="mt-6 space-y-3">
              <input name="email" type="email" placeholder="Email" className="field-input" required />
              <button disabled={pending} className="btn-accent w-full">
                {pending ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
          Remembered it?{' '}
          <Link href="/login" className="text-accent underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
