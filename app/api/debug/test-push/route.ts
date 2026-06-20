import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { sendPushDiagnostic } from '@/lib/notifications/push-server';

export const dynamic = 'force-dynamic';

// Admin-only push diagnostics. Open this from the *installed* app on the device
// you want to test (so the session cookie + that device's subscription are
// present), e.g. https://app.thinkbiz.solutions/api/debug/test-push
//
// It reports the notification config and sends a real test push to the calling
// admin's own subscriptions, returning the push service's status code for each.
// This isolates "sending is broken" (e.g. a VAPID key mismatch → 403) from
// "the trigger isn't firing" (the chat webhook), and sidesteps the chat rule
// that never notifies a message's own author.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const member = await getMemberForUser(supabase, user);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 403 });
  }
  if (!member.is_admin) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  // Config presence (booleans only — never echo secret values). The publicKeys
  // mismatch is the single most common silent push failure: the browser
  // subscribes with NEXT_PUBLIC_VAPID_PUBLIC_KEY but the server signs with
  // VAPID_PUBLIC_KEY/PRIVATE_KEY; if they aren't the same keypair every send
  // is rejected with 403.
  const serverPublic = process.env.VAPID_PUBLIC_KEY || '';
  const clientPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const config = {
    vapidPublicKeySet: !!serverPublic,
    vapidPrivateKeySet: !!process.env.VAPID_PRIVATE_KEY,
    vapidClientPublicKeySet: !!clientPublic,
    vapidPublicKeysMatch: !!serverPublic && serverPublic === clientPublic,
    resendApiKeySet: !!process.env.RESEND_API_KEY,
    emailFromSet: !!process.env.EMAIL_FROM,
    chatWebhookSecretSet: !!process.env.CHAT_WEBHOOK_SECRET,
    cronSecretSet: !!process.env.CRON_SECRET,
  };

  // Read this member's subscriptions with the service-role client.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_agent')
    .eq('member_id', member.id);

  const subscriptions = subs ?? [];

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const res = await sendPushDiagnostic(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title: 'ThinkBiz test push',
          body: 'If you can see this, push delivery works on this device. 🎉',
          url: '/dashboard',
          tag: 'debug-test-push',
        },
      );
      return {
        endpoint: `${sub.endpoint.slice(0, 40)}…`,
        userAgent: sub.user_agent,
        ok: res.ok,
        statusCode: res.statusCode,
        error: res.error,
      };
    }),
  );

  return NextResponse.json({
    memberId: member.id,
    config,
    subscriptionCount: subscriptions.length,
    results,
    hint:
      subscriptions.length === 0
        ? 'No push subscriptions for your member. Enable push from the installed app on this device first.'
        : !config.vapidPublicKeysMatch
          ? 'VAPID_PUBLIC_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY are not the same key — every push will 403. Set all three VAPID vars from one keypair, redeploy, then re-subscribe each device.'
          : results.every((r) => r.ok)
            ? 'Push sent successfully. If chat pushes still don’t arrive, the issue is the trigger (chat webhook) or you were the message author (authors are never notified).'
            : 'Push send failed — see statusCode/error per subscription (403/401 = VAPID mismatch, 404/410 = stale endpoint).',
  });
}
