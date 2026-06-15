'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/app/actions/auth';

export function MobileMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Standings' },
    { href: '/picks', label: 'My Picks' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-chalk transition-colors hover:border-white/30"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 top-14 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 top-14 z-50 border-b border-line bg-ink-900/95 backdrop-blur-xl">
            <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3">
              {links.map((l) => {
                const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-xl px-4 py-3.5 font-display text-lg uppercase tracking-wide transition-colors ${
                      active ? 'bg-accent/10 text-accent' : 'text-chalk hover:bg-white/5'
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}

              <div className="my-2 border-t border-line" />

              <div className="flex items-center justify-between px-4 py-2">
                <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-faint">
                  {name}
                </span>
                <form action={logout}>
                  <button className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-accent">
                    Sign out
                  </button>
                </form>
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
