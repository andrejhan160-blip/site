import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/session';

export default async function RootPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  redirect(profile.role === 'CLIENT' ? '/portal' : '/dashboard');
}
