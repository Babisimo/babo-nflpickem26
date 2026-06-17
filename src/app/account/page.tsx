import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { isProfileComplete } from '@/lib/profile';
import { AccountForm } from './AccountForm';

export default async function AccountPage() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, firstName: true, lastName: true, usernameChangeCount: true },
  });
  if (!me) redirect('/login');
  if (!isProfileComplete(me)) redirect('/complete-profile');

  return <AccountForm username={me.username} usernameChangeCount={me.usernameChangeCount} />;
}
