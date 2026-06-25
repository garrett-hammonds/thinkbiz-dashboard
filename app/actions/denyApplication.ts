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

    // Admins can deny for any club; a director only for their own. Load the
    // application's club first so we can enforce that boundary.
    const { data: application } = await supabase
      .from('pending_applications')
      .select('club_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (!application) {
      return { success: false, message: 'Application not found' };
    }

    if (!member.is_admin && application.club_id !== member.current_club_id) {
      return {
        success: false,
        message: 'You can only deny applications for your own club.',
      };
    }

    const { error } = await supabase
      .from('pending_applications')
      .delete()
      .eq('id', applicationId);

    if (error) {
      return { success: false, message: 'Failed to deny application' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error denying application:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}
