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
    .eq('user_id', user.id)
    .single();

  if (memberError || !memberData) {
    throw new Error('Member data not found');
  }

  const week_ending = formData.get('week_ending') as string || formData.get('week-ending') as string;
  const visitors_brought = parseInt(formData.get('visitors_brought') as string || formData.get('visitors-brought') as string || '0', 10);
  const one_on_ones_had = parseInt(formData.get('one_on_ones_had') as string || formData.get('one-on-ones') as string || '0', 10);
  const referrals_given = parseInt(formData.get('referrals_given') as string || formData.get('referrals-given') as string || '0', 10);

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

  if (logError || !log) {
    throw new Error('Failed to insert log');
  }

  const thanksJson = formData.get('revenue_thanks') as string;
  if (thanksJson) {
    try {
      const thanks: { memberId: string; amount: string }[] = JSON.parse(thanksJson);
      
      const validThanks = thanks.filter(entry => parseFloat(entry.amount) > 0);
      
      if (validThanks.length > 0) {
        const mappedThanks = validThanks.map(entry => ({
          weekly_log_id: log.id,
          thanking_member_id: memberData.id,
          thanked_member_id: entry.memberId === 'external' ? null : entry.memberId,
          revenue_amount: parseFloat(entry.amount)
        }));
        
        const { error: revenueError } = await supabase
          .from('closed_business_thanks')
          .insert(mappedThanks);
          
        if (revenueError) {
          console.error('Error inserting revenue:', revenueError);
        }
      }
    } catch (e) {
      console.error('Error parsing revenue_thanks:', e);
    }
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?message=Log submitted successfully');
}
