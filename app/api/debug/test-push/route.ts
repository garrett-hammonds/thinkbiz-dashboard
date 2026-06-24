import { NextResponse } from 'next/server';
import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
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
  const admin = createAdminClient();
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

  // Simulate the chat webhook's recipient resolution for this admin's club
  // channel, so we can see whether a real message *would* notify anyone —
  // without needing a second device or reading Vercel logs. Mirrors the logic
  // in app/api/webhooks/chat-message/route.ts (club members, is_active, minus
  // the author = you), then layers on push prefs + live subscriptions.
  const chatSimulation = await simulateChatRecipients(admin, member.id, member.current_club_id);

  return NextResponse.json({
    memberId: member.id,
    config,
    subscriptionCount: subscriptions.length,
    results,
    chatSimulation,
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

// Loose client type: the service-role client is created without generated DB
// types, so query rows come back untyped — which is fine for this debug route.
type AdminClient = SupabaseClient;

// Reproduces the chat webhook's "who gets notified" decision for the caller's
// club channel. The caller is treated as the message author (and therefore
// excluded, exactly like the real webhook), so this answers: "if I post in my
// club channel right now, who would actually receive a push?"
async function simulateChatRecipients(
  admin: AdminClient,
  authorMemberId: string,
  clubId: string | null,
) {
  if (!clubId) {
    return { note: 'You have no current_club_id, so you are not in a club channel.' };
  }

  const { data: channel } = await admin
    .from('chat_channels')
    .select('id, name')
    .eq('club_id', clubId)
    .maybeSingle();

  if (!channel) {
    return { note: 'No chat channel exists for your club. The club-channel auto-provision step may not have run.' };
  }

  // Same query the webhook uses for club channels.
  const { data: clubMembers } = await admin
    .from('members')
    .select('id, first_name, last_name, is_active')
    .eq('current_club_id', clubId)
    .eq('is_active', true);

  const recipientIds = (clubMembers ?? [])
    .map((m) => m.id as string)
    .filter((id) => id !== authorMemberId);

  if (recipientIds.length === 0) {
    return {
      channelName: channel.name,
      recipientCount: 0,
      note:
        'No other active members in your club channel, so a message from you would notify no one. Add/activate a second member (is_active = true) to test.',
    };
  }

  const [{ data: prefs }, { data: subs }] = await Promise.all([
    admin.from('notification_preferences').select('member_id, push_enabled, push_chat').in('member_id', recipientIds),
    admin.from('push_subscriptions').select('member_id').in('member_id', recipientIds),
  ]);

  const prefByMember = new Map((prefs ?? []).map((p) => [p.member_id as string, p]));
  const subCountByMember = new Map<string, number>();
  for (const s of subs ?? []) {
    const id = s.member_id as string;
    subCountByMember.set(id, (subCountByMember.get(id) ?? 0) + 1);
  }

  const recipients = (clubMembers ?? [])
    .filter((m) => recipientIds.includes(m.id as string))
    .map((m) => {
      const pref = prefByMember.get(m.id as string);
      // Missing prefs default to ON (opt-out model), matching the dispatcher.
      const pushChatEnabled = pref ? pref.push_enabled !== false && pref.push_chat !== false : true;
      const subs = subCountByMember.get(m.id as string) ?? 0;
      return {
        name: [m.first_name, m.last_name].filter(Boolean).join(' ') || '(no name)',
        pushChatEnabled,
        subscriptionCount: subs,
        wouldReceivePush: pushChatEnabled && subs > 0,
      };
    });

  const wouldReceive = recipients.filter((r) => r.wouldReceivePush).length;

  return {
    channelName: channel.name,
    recipientCount: recipientIds.length,
    wouldReceivePushCount: wouldReceive,
    recipients,
    note:
      wouldReceive === 0
        ? 'A message from you would notify NO ONE: the other members either have push turned off for chat or have no live subscription. Have them enable push from the installed app.'
        : `A message from you would push to ${wouldReceive} member(s). If those members still see nothing, the Supabase chat webhook is not firing — check Database → Webhooks → Logs for a 200 on each message.`,
  };
}
