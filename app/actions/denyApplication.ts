'use server';

import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';

export async function denyApplication(applicationId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Unauthorized' };
    }

    const member = await getMemberForUser(supabase, user);

    if (!member || (!member.is_admin && !member.club_director)) {
      return { success: false, message: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('pending_applications')
      .delete()
      .eq('id', applicationId);

    if (error) {
      return { success: false, message: 'Failed to deny application' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error denying application:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}
