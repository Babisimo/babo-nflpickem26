import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'NFL 2026 Pick’em',
  description: 'Pick every game of the 2026 NFL season.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-bold">NFL 2026 Pick&rsquo;em</Link>
            <Link href="/picks" className="text-sm text-slate-600 hover:text-slate-900">My Picks</Link>
            <Link href="/standings" className="text-sm text-slate-600 hover:text-slate-900">Standings</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
