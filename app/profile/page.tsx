import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import ProfileForm from '@/components/profile-form';
import { getMemberForUser } from '@/utils/supabase/getMember';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  if (!member) {
    redirect('/access-denied');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <ProfileForm member={member} />
      </main>
    </div>
  );
}
