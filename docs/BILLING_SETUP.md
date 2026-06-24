# Membership billing setup (Stripe)

Members must hold an active Stripe subscription to use the app. The code is in
place; this doc covers the one-time Stripe + env setup to turn it on.

## How it works

- **Hard gate after onboarding.** A member sets their password → completes their
  profile (`/onboarding`) → then hits the paywall at `/billing` and can't reach
  the dashboard, chat, logs, or getting-started until their subscription is
  active. Directors and admins are never gated (they run the clubs and aren't
  billed). `/profile` stays reachable so a member can always log out.
- **One price for everyone.** A single recurring Stripe Price (`STRIPE_PRICE_ID`)
  applies to all members across all clubs.
- **Feature-flagged.** The gate is a no-op until BOTH `STRIPE_SECRET_KEY` and
  `STRIPE_PRICE_ID` are set (`isBillingEnabled()`). Set them when you're ready to
  switch the paywall on; until then the app behaves exactly as before.
- **Directors see who paid.** The roster (`/dashboard/roster`) shows a Paid /
  Unpaid badge per member, summary counts, and a payment filter — but only once
  billing is enabled.

### Flow

```
Approved member → welcome email → set password → /onboarding → /billing
   → Stripe Checkout (hosted) → /billing/success (confirms + unlocks) → /dashboard
```

Source of truth for ongoing status (renewals, failed payments, cancellations) is
the webhook at `POST /api/webhooks/stripe`; the success route only does the
first immediate confirmation so a member who just paid isn't bounced back to the
paywall while the webhook is in flight.

## 1. Apply the database migration

`supabase/migrations/20260624_membership_billing.sql` adds the billing columns to
`members` (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`,
`subscription_current_period_end`) and an index. Apply with `supabase db push` or
paste it into the Supabase SQL editor.

## 2. Create the Stripe product & price

In the Stripe dashboard (use **Test mode** while developing):

1. **Products → Add product.** Name it e.g. "ThinkBiz Membership".
2. Add a **recurring** price (e.g. $X / month). Save.
3. Copy the **Price ID** (`price_...`) → this is `STRIPE_PRICE_ID`.
4. **Developers → API keys** → copy the **Secret key** (`sk_test_...` in test) →
   this is `STRIPE_SECRET_KEY`.

## 3. Set up the webhook

**Production / preview:**

1. **Developers → Webhooks → Add endpoint.**
2. URL: `https://YOUR_DOMAIN/api/webhooks/stripe`
3. Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the endpoint's **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

**Local dev:** install the Stripe CLI and run:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

It prints a `whsec_...` to use as `STRIPE_WEBHOOK_SECRET` locally.

## 4. Environment variables

Set these locally and in Vercel (see `.env.example`):

- `STRIPE_SECRET_KEY` — Stripe secret key.
- `STRIPE_PRICE_ID` — the recurring membership Price ID.
- `STRIPE_WEBHOOK_SECRET` — the webhook signing secret.

`NEXT_PUBLIC_SITE_URL` (already set) is used to build the Checkout success/cancel
URLs, so make sure it points at the real deployed origin in production.

## 5. Verify

1. With billing enabled, sign in as a non-director member with no subscription →
   you should land on `/billing`.
2. Use a [Stripe test card](https://stripe.com/docs/testing) (`4242 4242 4242
   4242`, any future expiry/CVC) to subscribe → you should land on `/dashboard`.
3. Check the member's row in `members` now has `subscription_status = active`.
4. As a director, open `/dashboard/roster` → the member shows **Paid**.
5. Cancel the subscription from Stripe → the `customer.subscription.deleted`
   webhook flips them back to unpaid and the gate re-engages.

## Existing subscribers (reuse an existing price)

If members are already subscribed to your membership price (e.g. set up through
GoHighLevel / LeadConnector on the **same** Stripe account), reuse that price —
nobody needs to resubscribe. The app recognizes existing subscriptions; it
doesn't require they were created through its own checkout.

**Prerequisite:** the existing subscriptions must live in the same Stripe account
as `STRIPE_SECRET_KEY`. Verify by opening that Stripe dashboard → Customers and
confirming your current paying members appear there. (With the typical
LeadConnector OAuth setup they do — payments settle to your account/bank.) If
they only appear inside GoHighLevel and not in this Stripe dashboard, they're on
a different/connected account this key can't see — stop and reassess.

How the app links them (all by email, no resubscribe):

- **On the paywall** — an unpaid member who hits `/billing` is checked against
  Stripe by email; an existing active subscription is linked and they're sent
  straight to the dashboard.
- **Webhook** — subscription events are matched to members by email when there's
  no metadata/customer-id match yet, so renewals on old subscriptions keep status
  current.
- **One-time backfill** — sign in as an admin and visit
  `/api/admin/reconcile-subscriptions`. It links every active subscription to its
  member and returns a JSON summary, including any subscriber emails that didn't
  match a member row (usually an email mismatch to fix by hand). Safe to re-run.

### Safe rollout order (so no paying member is ever gated)

1. Apply the migration and set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, but
   **leave `STRIPE_PRICE_ID` unset** — billing (and the paywall) stays off.
2. Deploy. Temporarily set `STRIPE_PRICE_ID` only long enough to run the backfill
   once (`/api/admin/reconcile-subscriptions`), or run the backfill in a
   preview/staging deploy that has the price set.
3. Confirm the roster shows your existing members as **Paid** and resolve any
   unmatched emails.
4. Set `STRIPE_PRICE_ID` in production and redeploy — the paywall now only stops
   members who genuinely have no active subscription.

## Self-service subscription management

Members manage everything themselves from **Profile → Membership**:

- **First-time join** — the "Start membership" button (and the post-onboarding
  paywall at `/billing`) opens Stripe Checkout.
- **Manage / change card / add a backup card / update billing info / cancel** —
  the "Manage membership" button opens the Stripe **Customer Portal**
  (`createBillingPortalSession`). The card also shows current status (Active,
  Payment past due, None) and the renewal date.

### Activate the Customer Portal (one-time, required)

The portal must be turned on once per mode or "Manage membership" will error:

1. Stripe dashboard → **Settings → Billing → Customer portal**
   (https://dashboard.stripe.com/settings/billing/portal).
2. Activate it, and under **Functionality** enable at least: update payment
   method, and (if you want self-serve cancellation) cancel subscriptions.
3. Save. Do this in **Test** and **Live** modes separately.

## Notes

- To roll out gradually, leave `STRIPE_PRICE_ID` unset (gate off) while you
  reconcile existing members, then set it to switch the paywall on for everyone.
