'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// Remove a visitor (spam/duplicate). Authorization is enforced by the
// visitors_delete RLS policy: only admins, or a club director for that
// visitor's own club, can delete — so we run as the signed-in user.
export async function deleteVisitorAction(visitorId: string) {
  if (!visitorId) {
    return { success: false, message: 'Missing visitor id.' };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'Not authenticated.' };
  }

  const { error } = await supabase.from('visitors').delete().eq('id', visitorId);

  if (error) {
    console.error('Error deleting visitor:', error);
    return { success: false, message: 'Could not remove visitor.' };
  }

  revalidatePath('/dashboard/visitors');
  return { success: true };
}
