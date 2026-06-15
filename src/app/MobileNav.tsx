'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; icon: React.ReactNode };

function Trophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" strokeLinejoin="round" />
      <path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M9 20h6M12 13v3" strokeLinecap="round" />
    </svg>
  );
}
function Grid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <path d="M16.5 14v5M14 16.5h5" strokeLinecap="round" />
    </svg>
  );
}
function Shield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: '/', label: 'Standings', icon: <Trophy /> },
    { href: '/picks', label: 'Picks', icon: <Grid /> },
  ];
  if (isAdmin) items.push({ href: '/admin', label: 'Admin', icon: <Shield /> });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink/90 backdrop-blur-xl sm:hidden">
      <ul
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((it) => {
          const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <span className={active ? 'drop-shadow-[0_0_8px_rgba(200,255,60,0.5)]' : ''}>
                  {it.icon}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
