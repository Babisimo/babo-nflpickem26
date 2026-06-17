'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  changePassword,
  changeUsername,
  type ChangePasswordState,
  type ChangeUsernameState,
} from '@/app/actions/auth';
import { usernameChangesRemaining, MAX_USERNAME_CHANGES } from '@/lib/profile';

export function AccountForm({
  username,
  usernameChangeCount,
}: {
  username: string | null;
  usernameChangeCount: number;
}) {
  const router = useRouter();
  const remaining = usernameChangesRemaining(usernameChangeCount);

  const [pwState, pwAction, pwPending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    undefined,
  );
  const [unState, unAction, unPending] = useActionState<ChangeUsernameState, FormData>(
    changeUsername,
    undefined,
  );

  // After a successful username change, re-render the server page so the handle
  // and the remaining-changes count refresh.
  useEffect(() => {
    if (unState?.ok) router.refresh();
  }, [unState, router]);

  return (
    <div className="mx-auto max-w-sm space-y-6">
      {/* Change username */}
      <div className="reveal card p-8">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-4xl uppercase tracking-tight text-chalk">
          Change username
        </h1>
        <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.1em] text-faint">
          {username ? <span className="text-chalk">@{username}</span> : 'No username set'}
          {' · '}
          {remaining} of {MAX_USERNAME_CHANGES} changes left
        </p>

        {unState?.ok && (
          <p className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-accent">
            Username updated
          </p>
        )}
        {unState?.error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {unState.error}
          </p>
        )}

        {remaining > 0 ? (
          <form action={unAction} className="mt-6 space-y-3">
            <input
              name="username"
              type="text"
              placeholder="New username"
              className="field-input"
              required
            />
            <button disabled={unPending} className="btn-accent w-full">
              {unPending ? 'Saving…' : 'Update username'}
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded-xl border border-line bg-ink-900/40 px-4 py-3 text-sm text-muted">
            You’ve used all your username changes.
          </p>
        )}
      </div>

      {/* Change password */}
      <div className="reveal card p-8">
        <h2 className="font-display text-2xl uppercase tracking-tight text-chalk">Change password</h2>

        {pwState?.ok && (
          <p className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-accent">
            Password updated
          </p>
        )}
        {pwState?.error && (
          <p className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {pwState.error}
          </p>
        )}

        <form action={pwAction} className="mt-6 space-y-3">
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
          <button disabled={pwPending} className="btn-accent w-full">
            {pwPending ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
