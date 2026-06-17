import { redirect } from 'next/navigation';
import { auth, type AppSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { isProfileComplete } from '@/lib/profile';
import { CompleteProfileForm } from './CompleteProfileForm';

export default async function CompleteProfilePage() {
  const session = (await auth()) as AppSession | null;
  const userId = session?.user?.id;
  if (!userId) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, firstName: true, lastName: true },
  });
  if (user && isProfileComplete(user)) redirect('/picks');

  return <CompleteProfileForm />;
}
