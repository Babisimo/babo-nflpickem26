import './globals.css';
import type { Metadata } from 'next';
import { Anton, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import { auth, type AppSession } from '@/lib/auth';
import { logout } from '@/app/actions/auth';
import { MobileNav } from '@/app/MobileNav';

const display = Anton({ subsets: ['latin'], weight: '400', variable: '--font-display' });
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: "NFL 2026 Pick'em",
  description: 'Pick every game of the 2026 NFL season. Most correct wins.',
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-chalk"
    >
      {children}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = (await auth()) as AppSession | null;
  const user = session?.user;

  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="sticky top-0 z-50 border-b border-line bg-ink/70 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-ink shadow-glow">
                <span className="font-display text-lg leading-none">26</span>
              </span>
              <span className="font-display text-xl uppercase tracking-wide text-chalk">
                NFL Pick&rsquo;em
              </span>
            </Link>

            <div className="ml-2 hidden items-center gap-6 sm:flex">
              <NavLink href="/">Standings</NavLink>
              <NavLink href="/picks">My Picks</NavLink>
              {user?.isAdmin && <NavLink href="/admin">Admin</NavLink>}
            </div>

            <div className="ml-auto flex items-center gap-4">
              {user ? (
                <>
                  <span className="hidden font-mono text-[12px] uppercase tracking-[0.14em] text-faint md:inline">
                    {user.name}
                  </span>
                  <form action={logout}>
                    <button className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-accent">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn-accent px-4 py-2">
                  Log in
                </Link>
              )}
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-7 sm:px-5 sm:py-10">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-5 sm:pb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
            2026 Season &middot; Data via nflverse
          </p>
        </footer>

        {user && <MobileNav isAdmin={!!user.isAdmin} />}
      </body>
    </html>
  );
}
