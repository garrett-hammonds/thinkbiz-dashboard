'use server';

import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';

interface SubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

// Persists a browser's Web Push subscription for the signed-in member.
// Upserts on the unique `endpoint` so re-subscribing the same browser refreshes
// rather than duplicating. RLS additionally constrains writes to the caller's row.
export async function savePushSubscription(input: SubscriptionInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Not authenticated' };

  const member = await getMemberForUser(supabase, user);
  if (!member) return { success: false, message: 'Member not found' };

  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { success: false, message: 'Invalid subscription' };
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        member_id: member.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

  if (error) {
    console.error('[pushSubscription] upsert failed:', error);
    return { success: false, message: error.message };
  }
  return { success: true };
}

// Removes a subscription when the member disables push in this browser.
export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'Not authenticated' };

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[pushSubscription] delete failed:', error);
    return { success: false, message: error.message };
  }
  return { success: true };
}
