import { redirect } from 'next/navigation';

// Standings is now the home page; keep this route working for old links.
export default function StandingsPage() {
  redirect('/');
}
