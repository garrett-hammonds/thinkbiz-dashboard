'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';

// Native (iOS / Android) push enrollment for the Capacitor shell. The browser
// equivalent is app/actions/pushSubscription.ts. Both are called from the
// signed-in member's own client; the service-role client is used for the
// upsert so a token that moves to another member (shared phone, new sign-in)
// can be re-pointed even though RLS would hide the previous owner's row.

const PLATFORMS = new Set(['ios', 'android']);

export interface NativePushInput {
  platform: string;
  token: string;
  appVersion?: string;
}

export interface NativePushResult {
  success: boolean;
  reason?: 'unauthenticated' | 'invalid' | 'error';
}

export async function registerNativePushToken(input: NativePushInput): Promise<NativePushResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, reason: 'unauthenticated' };

  const member = await getMemberForUser(supabase, user);
  if (!member) return { success: false, reason: 'unauthenticated' };

  const platform = typeof input.platform === 'string' ? input.platform : '';
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  if (!PLATFORMS.has(platform) || !token || token.length > 4096) {
    return { success: false, reason: 'invalid' };
  }

  const { error } = await createAdminClient()
    .from('native_push_tokens')
    .upsert(
      {
        member_id: member.id,
        platform,
        token,
        app_version: typeof input.appVersion === 'string' ? input.appVersion.slice(0, 40) : null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

  if (error) {
    console.error('[nativePush] upsert failed:', error);
    return { success: false, reason: 'error' };
  }
  return { success: true };
}

// Removes this phone's enrollment when the member turns push off in the app.
export async function removeNativePushToken(token: string): Promise<NativePushResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, reason: 'unauthenticated' };

  const trimmed = typeof token === 'string' ? token.trim() : '';
  if (!trimmed) return { success: false, reason: 'invalid' };

  // RLS limits this to the caller's own rows.
  const { error } = await supabase.from('native_push_tokens').delete().eq('token', trimmed);
  if (error) {
    console.error('[nativePush] delete failed:', error);
    return { success: false, reason: 'error' };
  }
  return { success: true };
}
