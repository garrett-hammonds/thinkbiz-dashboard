import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { Navbar } from '@/components/navbar';
import InviteDirectorForm from '@/components/InviteDirectorForm';

export default async function InviteDirectorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const member = await getMemberForUser(supabase, user);
  if (!member?.is_admin) redirect('/access-denied');

  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name')
    .order('name');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold leading-snug text-foreground mb-2">Invite a Director</h1>
        <p className="text-gray-500 mb-8">
          Generate a single signed invite link for a new Club Director. The recipient sets up
          their profile and password without needing approval.
        </p>
        <InviteDirectorForm clubs={clubs ?? []} />
      </main>
    </div>
  );
}
