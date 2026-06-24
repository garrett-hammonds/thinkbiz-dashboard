'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function submitLogAction(formData: FormData) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('id, current_club_id')
    .eq('auth_user_id', user.id)
    .single();

  if (memberError || !memberData) {
    throw new Error('Member data not found');
  }

  const week_ending = formData.get('week_ending') as string || formData.get('week-ending') as string;
  const visitors_brought = parseInt(formData.get('visitors_brought') as string || formData.get('visitors-brought') as string || '0', 10);
  const one_on_ones_had = parseInt(formData.get('one_on_ones_had') as string || formData.get('one-on-ones') as string || '0', 10);
  const referrals_given = parseInt(formData.get('referrals_given') as string || formData.get('referrals-given') as string || '0', 10);

  // Parse the closed-business "thank you" entries up front so we can still
  // record them even when a weekly log already exists for this week.
  let validThanks: { memberId: string; amount: string }[] = [];
  const thanksJson = formData.get('revenue_thanks') as string;
  if (thanksJson) {
    try {
      const thanks: { memberId: string; amount: string }[] = JSON.parse(thanksJson);
      validThanks = thanks.filter((entry) => parseFloat(entry.amount) > 0);
    } catch (e) {
      console.error('Error parsing revenue_thanks:', e);
    }
  }

  const { data: log, error: logError } = await supabase
    .from('weekly_logs')
    .insert({
      member_id: memberData.id,
      club_id: memberData.current_club_id,
      week_ending,
      visitors_brought,
      one_on_ones_had,
      referrals_given,
    })
    .select('id')
    .single();

  let logId: string | undefined = log?.id;
  let alreadyLogged = false;

  if (logError || !log) {
    // weekly_logs has a unique constraint preventing multiple logs per week.
    // Rather than dropping the closed business the member just entered, attach
    // it to the log that already exists for this week.
    if (logError?.code === '23505') {
      // Already logged this week. If there's no closed business to add, there's
      // nothing more to do — tell them and stop.
      if (validThanks.length === 0) {
        redirect('/log?message=You have already logged this week — no changes were made.');
      }

      const { data: existingLog } = await supabase
        .from('weekly_logs')
        .select('id')
        .eq('member_id', memberData.id)
        .eq('week_ending', week_ending)
        .maybeSingle();

      if (!existingLog) {
        redirect('/log?message=You have already logged this week — no changes were made.');
      }

      logId = existingLog.id;
      alreadyLogged = true;
    } else {
      console.error('Error inserting weekly log:', logError);
      redirect('/log?message=Something went wrong and your log could not be saved. Please try again.');
    }
  }

  if (validThanks.length > 0 && logId) {
    const mappedThanks = validThanks.map((entry) => ({
      weekly_log_id: logId,
      thanking_member_id: memberData.id,
      thanked_member_id:
        entry.memberId === 'external' || entry.memberId === '' ? null : entry.memberId,
      revenue_amount: parseFloat(entry.amount),
    }));

    const { error: revenueError } = await supabase
      .from('closed_business_thanks')
      .insert(mappedThanks);

    if (revenueError) {
      // Surface the failure instead of reporting a false success — otherwise
      // the closed business is silently lost.
      console.error('Error inserting revenue:', revenueError);
      redirect('/log?message=Your log was saved, but the closed business could not be recorded. Please try again.');
    }
  }

  revalidatePath('/dashboard');

  if (alreadyLogged) {
    redirect('/dashboard?message=We added that closed business to this week’s log.');
  }
  redirect('/dashboard?message=Your log is saved.');
}
