# Visitors — setup & how it works

The visitor list lets any active club member see who pre-registered or checked
in at a meeting, so they can follow up before/after. It also replaces the old
Google Form + QR code with an in-app public check-in form.

## 1. Apply the migration

Run `supabase/migrations/20260624_club_visitors.sql` in the Supabase SQL editor
(or `supabase db push`). It creates the `visitors` table, the
`visitor_member_club()` / `visitor_is_admin()` / `visitor_can_moderate()` helper
functions, and the RLS policies.

## 2. Environment

The QR page uses the existing `NEXT_PUBLIC_SITE_URL` to build the public
check-in URL, so make sure it's set to the live site (e.g.
`https://app.thinkbiz.solutions`) in production. `NEXT_PUBLIC_SITE_URL` is also
used to build the "Learn about membership" link in the visitor welcome email
(it points at `/apply`).

One **optional** variable: `FORMSPREE_VISITOR_ENDPOINT`. The form always writes
to the Supabase `visitors` table; when this is set it *also* forwards each entry
to Formspree for an email/dashboard copy. It defaults to the live Formspree form
(`https://formspree.io/f/mgojolqz`) when unset, so set it only to repoint it.

The **visitor welcome email** (below) reuses the existing Resend setup — it
sends only when `RESEND_API_KEY` and `EMAIL_FROM` are configured (the same two
variables that power approval/invite emails). No new variable is required; if
those are unset the send is silently skipped and check-in still succeeds.

## Visitor welcome email (membership invite)

When a visitor checks in **and leaves an email address**, they're sent a
best-effort welcome email (`visitorWelcomeEmail` in `lib/email/templates.ts`,
fired from `app/visit/[clubId]/submitVisitor.ts`). It introduces ThinkBiz
membership and its benefits and invites them back to a future meeting, with a
"Learn about membership" button pointing at `/apply`.

Like the Formspree forward, this is **best-effort**: the `visitors` row is the
record of truth, so an email failure never blocks a successful check-in. It only
fires for the in-app check-in path. See §5 to also cover direct inserts (e.g.
the marketing-site pre-registration form).

## 3. How it works

- **Public check-in form:** `/visit/<clubId>` — no login required. Visitors
  submit name + email/phone (and optional company, title, notes). Rows are
  inserted into the `visitors` table with `source = 'meeting'` via the anon
  Supabase role — this is the record of truth the app reads from. Each entry is
  then forwarded to Formspree on a **best-effort** basis (an email/dashboard
  copy); a Formspree failure never blocks a successful check-in.
- **QR code for slides:** directors/admins open `/dashboard/visitors/qr` to get
  a printable/downloadable QR code that points at their club's `/visit/<clubId>`
  URL. Put it on your meeting slides.
- **Visitor list:** `/dashboard/visitors` — every active member sees their own
  club's visitors (scoped by `current_club_id` via RLS). Email/phone render as
  `mailto:`/`tel:` links. Directors/admins can remove spam/duplicates.

## 4. Re-pointing the marketing-site preregistration form (later)

The marketing site's preregistration form can write directly into this same
table so pre-registrations show up in the app. Insert with the anon key and use
`source = 'preregistration'`:

```js
await supabase.from('visitors').insert({
  club_id: '<the club uuid>',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',   // email and/or phone required
  phone: '555-123-4567',
  company_name: 'Acme Co',     // optional
  title: 'Founder',            // optional
  notes: 'Found us on LinkedIn',// optional
  source: 'preregistration',
});
```

`visited_on` defaults to the current date; pass it explicitly if you want the
meeting date the visitor registered for.

## 5. Sending the welcome email on *every* insert (optional follow-up)

The welcome email currently fires from the in-app check-in action, so direct
inserts (the pre-registration form in §4) won't trigger it. To send on **any**
insert into `visitors` regardless of source, move the trigger into the database:

1. Add a Supabase **Database Webhook** on `INSERT` to `public.visitors` that
   POSTs to an app route (e.g. `/api/visitors/welcome`), guarded by a shared
   secret header — mirror the existing chat webhook (`CHAT_WEBHOOK_SECRET`).
2. That route validates the secret, then calls the same `visitorWelcomeEmail`
   template + `sendEmail()` already used here. Skip rows where `email IS NULL`
   and, if you want to avoid double-sends, have the in-app action stop sending
   once the webhook is live (or de-dupe on a `welcomed_at` column).

This keeps the email logic in one template and makes "new visitor enters the
database" the literal trigger for the email, no matter which form wrote the row.
