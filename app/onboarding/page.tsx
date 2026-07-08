import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import OnboardingForm from '@/components/OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const member = await getMemberForUser(supabase, user);
  if (!member) redirect('/access-denied');

  if (member.profile_completed_at) redirect('/dashboard');

  let clubName = 'your club';
  if (member.current_club_id) {
    const { data: club } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', member.current_club_id)
      .maybeSingle();
    if (club?.name) clubName = club.name;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold leading-snug text-foreground mb-2">
          Welcome to ThinkBiz
        </h1>
        <p className="text-gray-500 mb-8">
          Confirm or update your profile below. This is what other members will see when they
          look you up. You can edit any of it later from your profile page.
        </p>
        <OnboardingForm member={member} clubName={clubName} />
      </main>
    </div>
  );
}
