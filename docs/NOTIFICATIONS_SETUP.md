# Notifications setup

Email (Resend) + Web Push notifications for the ThinkBiz dashboard. The app code
is in place; this doc covers the one-time operational steps to turn it on.

## Triggers

| Event | Mechanism | Recipients |
|---|---|---|
| Application approved | Inline in `approveApplication` server action | The approved member (push + email) |
| Weekly log reminder | Vercel Cron → `GET /api/cron/weekly-log-reminder` | Active members with no log in the last 7 days (push + email) |
| New chat message | Supabase Database Webhook → `POST /api/webhooks/chat-message` | Channel members minus author: **push to all**, **email only to @-mentioned** |

All sending goes through `lib/notifications/dispatch.ts`, which honors each
member's saved preferences (`notification_preferences`). Preferences default to
ON (opt-out); members manage them on the profile page.

## 1. Apply the database migration

`supabase/migrations/20260619_notifications.sql` adds `notification_preferences`
and `push_subscriptions` (+ RLS). Apply with `supabase db push` or paste it into
the Supabase SQL editor.

## 2. Environment variables

See `.env.example`. Set these locally and in Vercel:

- `RESEND_API_KEY`, `EMAIL_FROM` — Resend key + a verified sending domain.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` —
  generate once: `npx web-push generate-vapid-keys` (public key goes in both the
  server and `NEXT_PUBLIC_` vars).
- `CRON_SECRET` — any random string; Vercel automatically sends it as a Bearer token.
- `CHAT_WEBHOOK_SECRET` — any random string; used to authenticate the Supabase webhook.

## 3. Vercel Cron

`vercel.json` schedules the weekly reminder for Fridays 14:00 UTC
(`0 14 * * 5`). Adjust the day/time/timezone as desired. Vercel injects the
`CRON_SECRET` Bearer header automatically on deployed projects.

## 4. Supabase Database Webhook (chat)

Chat messages are inserted client-side, so notifications rely on a Database
Webhook. In the Supabase dashboard → **Database → Webhooks**, create a webhook:

- Table: `public.chat_messages`
- Events: **Insert**
- Type: HTTP Request, **POST** to `https://<your-domain>/api/webhooks/chat-message`
- HTTP header: `x-webhook-secret: <CHAT_WEBHOOK_SECRET>`

This is per-environment and is **not** recreated by the migration on preview
branches — configure it wherever you want chat notifications.

## 5. Replace placeholder icons (optional)

`public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and `badge.png`
are placeholders (copies of the emblem). Swap in properly sized assets when ready.

## Notes

- **iOS**: web push only works once the site is installed to the Home Screen
  (Share → Add to Home Screen). The profile UI shows this hint on iOS.
- All sends are best-effort — a Resend/web-push failure never breaks the
  originating action (approval, log submission, chat insert).
