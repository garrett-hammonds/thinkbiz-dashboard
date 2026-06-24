import { NextResponse } from 'next/server';
import { dispatchChatMessageNotifications } from '@/lib/notifications/chat';

export const dynamic = 'force-dynamic';

interface WebhookBody {
  type?: string;
  table?: string;
  record?: { id?: string } | null;
}

// OPTIONAL backstop for chat notifications.
//
// The web client now dispatches chat notifications itself, right after inserting
// a message (app/actions/chat.ts -> notifyChatMessage), so a manually-configured
// Supabase Database Webhook is no longer required for notifications to work.
//
// This route remains so a Supabase Database Webhook (chat_messages INSERT) can
// still drive notifications for messages created outside the web client. The
// dispatcher claims each message atomically (chat_messages.notified_at), so the
// webhook and the client trigger can both fire without double-sending.
export async function POST(request: Request) {
  const secret = process.env.CHAT_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messageId = body.record?.id;
  if (!messageId) {
    return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
  }

  await dispatchChatMessageNotifications(messageId);
  return NextResponse.json({ ok: true });
}
