import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import ProfileForm from '@/components/profile-form';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { DEFAULT_PREFS, type NotificationPrefs } from '@/components/NotificationSettings';

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

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  // Load saved notification preferences; a missing row means the member has
  // never changed them, so fall back to the opt-out defaults (all on).
  const { data: prefsRow } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('member_id', member.id)
    .maybeSingle();

  const prefs: NotificationPrefs = prefsRow
    ? {
        email_enabled: prefsRow.email_enabled,
        push_enabled: prefsRow.push_enabled,
        email_chat: prefsRow.email_chat,
        email_log_reminder: prefsRow.email_log_reminder,
        email_application: prefsRow.email_application,
        push_chat: prefsRow.push_chat,
        push_log_reminder: prefsRow.push_log_reminder,
        push_application: prefsRow.push_application,
      }
    : DEFAULT_PREFS;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="py-12 px-4 sm:px-6 lg:px-8">
        <ProfileForm member={member} prefs={prefs} />
      </main>
    </div>
  );
}
