# Mobile apps (iOS / Android) — setup & store submission

The phone apps live in the **`thinkbiz-mobile-app`** repository: a thin
[Capacitor](https://capacitorjs.com) shell that loads this deployed dashboard
(`https://app.thinkbiz.solutions`) by URL and adds what a WebView cannot do
on its own (native push, universal links, the system browser for Stripe, the
share sheet, an offline page). Nothing in the shell talks to Supabase or
Stripe; every request still comes through this app with the normal session
cookie. This is the same pattern as HMM Flow (`hmm-team-app` +
`hmm-mobile-app`).

This document covers **what this repo provides for the shell** and **the
one-time operational steps** to get both apps into the stores.

## What this repo provides

| Piece | Where | Notes |
|---|---|---|
| Host detection + plugin adapter | `lib/native/bridge.ts`, `types/native.d.ts` | Detects `window.Capacitor`; everything else goes through `hostAdapter()`. Renders/does nothing in a browser. |
| Native event wiring | `components/native/NativeBridge.tsx` | Mounted once in `app/layout.tsx`. Notification taps, universal links, `thinkbiz://return`, Android back button, off-origin links → system browser, status bar, splash, first-launch push prompt, token refresh. |
| Offline notice | `components/native/OfflineBanner.tsx` | Mid-session drop; the shell's bundled `www/error.html` covers a cold start with no network. |
| Native push | `supabase/migrations/20260921000100_native_push_tokens.sql`, `app/actions/nativePush.ts`, `lib/native/push.ts`, `lib/notifications/push-native.ts` | FCM tokens per phone; `dispatchNotifications` fans out to browser push **and** phones. Needs `FIREBASE_SERVICE_ACCOUNT_JSON`. |
| Push UI | `components/NotificationSettings.tsx`, `components/GettingStartedChecklist.tsx` | Inside the app, "Enable push" uses the OS prompt + FCM instead of the browser PushManager; the app counts as "installed". |
| No purchasing in the app | `app/(app)/billing/MembershipOffer.tsx`, `components/MembershipCard.tsx`, `lib/native/useIsNative.ts` | App Store 3.1.1. Inside the shell `/billing` only says the membership isn't active (no checkout, perks pitch, or pointer to the website), and the profile card shows status only (no portal, no start/restart link). The web keeps Stripe Checkout and the portal. The system-browser checkout plumbing (`CheckoutButton`, `/billing/return`) stays for the web flow and is unreachable from the app. |
| Chat safety (UGC) | `supabase/migrations/20260930000100_chat_safety.sql`, `app/actions/chatSafety.ts`, `components/chat/ReportMessageModal.tsx`, `components/chat/ChatGuidelines.tsx`, `app/(app)/dashboard/chat-reports/`, `components/directory/ProfileActions.tsx`, `components/BlockedMembersSection.tsx` | App Store 1.2. Members accept the chat guidelines (zero tolerance) once; report any message (flag on the message; tap it on a phone); block anyone from DMing them (DM header, directory profile; unblock on `/profile`). Reports email + push the reported member's club directors and all admins; they act at `/dashboard/chat-reports` (remove message, remove + suspend from chat, dismiss). Directors/admins can also suspend from a directory profile. Blocks and suspensions are enforced by RLS. |
| Store compliance pages | `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/(app)/support/page.tsx` | Public (no session). Linked from login, profile, support. |
| Account deletion | `app/actions/deleteAccount.ts`, `components/DeleteAccountSection.tsx` (on `/profile`) | App Store 5.1.1(v) / Play account-deletion policy. Cancels Stripe, deletes tokens + prefs + headshot, scrubs PII, deletes the auth user. Directors/admins are refused (hand off first). |
| Universal links / App Links | `public/.well-known/apple-app-site-association`, `public/.well-known/assetlinks.json` | Placeholders for the Apple Team ID and the Play signing fingerprint — see below. `next.config.ts` serves the Apple file as `application/json`; `proxy.ts` skips `/.well-known/`. |
| Safe areas | `app/layout.tsx` (`viewportFit: cover`), `MobileTopBar`, `SidebarDrawer`, `globals.css` | Header/drawer pad by `env(safe-area-inset-top)`; body pads the bottom inside the shell. |
| Share sheet exports | `app/(app)/dashboard/visitors/qr/QrActions.tsx` | PNG/SVG go to the share sheet in the app (no download bar in a WebView). |
| Camera | `Scanner.tsx` (unchanged behaviour) | `getUserMedia` works in the WebView; the shell declares the camera permission and usage string. |

## 1. Apply the migration

Run `supabase/migrations/20260921000100_native_push_tokens.sql` (Supabase SQL
editor or `supabase db push`). Adds `native_push_tokens` with RLS. Safe to run
before the apps exist.

Then run `supabase/migrations/20260930000100_chat_safety.sql` (chat
reports, DM blocks, chat suspensions, guidelines acceptance). Run it before or
right after deploying the chat-safety code: until it runs, chat works but
reporting, blocking and the guidelines prompt don't.

## 2. Firebase (push for both platforms)

One Firebase project fronts both apps. Browser push (VAPID) is unchanged.

1. Firebase console → create project **ThinkBiz** (Analytics off).
2. Add an **iOS app** with bundle id `solutions.thinkbiz.app` → download
   `GoogleService-Info.plist` → save in the shell at
   `ios/App/App/GoogleService-Info.plist` and add it to the App target in
   Xcode. (Gitignored.)
3. Add an **Android app** with package `solutions.thinkbiz.app` → download
   `google-services.json` → save at `android/app/google-services.json`.
   (Gitignored.)
4. Apple Developer → Keys → create an **APNs Auth Key** (.p8). Firebase →
   Project settings → Cloud Messaging → iOS app → upload the .p8 with its Key
   ID and Team ID.
5. Firebase → Project settings → Service accounts → **Generate new private
   key**. Put the JSON **on one line** into `FIREBASE_SERVICE_ACCOUNT_JSON` in
   Vercel (Production + Preview). Until it is set, `sendNativePushes` is a
   no-op and everything else keeps working.

Test: sign in on a device build, allow notifications, then use the existing
`/api/debug/test-push` route or send a chat message from another account.

## 3. Universal links / App Links

Both files already list the right paths; fill in the identifiers once the
store accounts exist, then deploy:

- `public/.well-known/apple-app-site-association` — carries the Apple Team ID
  (`N532RM9A6P`). Update it only if the app moves to a different team.
- `public/.well-known/assetlinks.json` — replace the placeholder with the
  **Play App Signing** SHA-256 fingerprint (Play Console → Test and release →
  App integrity → App signing key certificate). Add the upload-key fingerprint
  too if you sideload release builds for testing.

Verify after deploy:

```bash
curl -sI https://app.thinkbiz.solutions/.well-known/apple-app-site-association | grep -i content-type   # application/json
curl -s https://app.thinkbiz.solutions/.well-known/assetlinks.json | head
```

Excluded from the app on purpose (they open in the browser): `/apply`,
`/visit/*`, `/privacy`, `/terms`, `/support`, `/api/*`.

## 4. Environment variables

| Var | Where | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Vercel | Native push. |
| `NEXT_PUBLIC_NATIVE_SCHEME` | Vercel (optional, default `thinkbiz`) | Custom scheme the shell registers; must match `capacitor.config.ts`. |
| `NEXT_PUBLIC_SITE_URL` | already set | Must be `https://app.thinkbiz.solutions` so Stripe return URLs and QR codes point at the host the app trusts. |

## 5. Store review accounts

Both stores need a working sign-in, and Apple wants credentials for **each
account type** in the App Review notes. The dashboard uses email + password,
so no code path is needed. On a demo club, create (approve an application,
complete onboarding):

- **Member** — e.g. `review@thinkbiz.solutions`, `billing_exempt = true` so
  the paywall never blocks the reviewer. Accept the chat guidelines once so
  chat opens straight away (or leave it so the reviewer sees the prompt).
- **Director** — e.g. `review-director@thinkbiz.solutions`, `club_director =
  true` on the same club. Reaches the attendance scanner (why the app asks for
  the camera) and `/dashboard/chat-reports`.
- Seed the demo club's chat with a few messages from both, and a DM between
  them, so report / block have something to act on.

Record account deletion with a separate throwaway member, never the review
accounts. Keep the review accounts active for the life of the listing;
reviews re-run on every update.

## 6. What to say in the store forms

**App Store — App Privacy (nutrition labels).** Data collected, linked to the
user, not used for tracking: Contact Info (name, email, phone), User Content
(photos — headshot and chat images; other user content — messages, logs),
Identifiers (user ID), Purchases (purchase history — subscription status via
Stripe), Usage Data: none. Diagnostics: none. No third-party advertising, no
tracking.

**Google Play — Data safety.** Same list. Data is encrypted in transit; users
can request deletion (in-app, `/profile`, and by email). Account creation:
email + password. Account deletion URL for the Play form:
`https://app.thinkbiz.solutions/profile` (and the privacy policy explains the
email route).

**Privacy policy URL:** `https://app.thinkbiz.solutions/privacy`
**Terms:** `https://app.thinkbiz.solutions/terms`
**Support URL:** `https://app.thinkbiz.solutions/support`

**Permissions rationale (App Review notes / Play declarations).**
Camera: club directors scan members' check-in QR codes at meetings
(`/dashboard/attendance/scan`). Photos: profile headshot and chat images.
Notifications: chat messages, weekly log reminders, application updates —
asked once on first launch, changeable on `/profile`.

**Payments.** The app sells nothing and has no In-App Purchase products;
the listing is Free. Membership dues cover a real-world networking club and
are handled on the ThinkBiz website only. Inside the app there is no checkout,
no billing portal, and no link or call to action pointing to either — an
unpaid member just sees that their membership isn't active (Guideline
3.1.1). Members can view their membership status and delete their account
(which cancels any subscription).

**User-generated content.** Members chat in club channels and direct
messages. Before first use they accept the chat guidelines (zero tolerance
for objectionable content). Any message can be reported (flag on the
message); any member can be blocked from direct messaging you (DM header or
directory profile). Reports go by email and push to the club's directors and
ThinkBiz admins, who review them within 24 hours at Chat Reports and can
remove the message and suspend the member from chat.

**Sign-up / audience (Guideline 3.2).** Anyone can apply from `/apply`
(public, opens in the browser from the app's login page) to join a ThinkBiz
club; clubs are open to local business owners and professionals, not one
company's staff, so the app is a public App Store app. Membership is by
director approval, which is allowed for membership-organisation apps as long
as the reviewer has working accounts (section 5). If Apple still classes it
as a single-organisation app, the fallback is Unlisted App Distribution (no
code change).

## 7. Release checklist (per version)

1. Deploy this repo first; the shell loads it live.
2. In `thinkbiz-mobile-app`: bump `versionCode`/`versionName`
   (`android/app/build.gradle`) and `CURRENT_PROJECT_VERSION` /
   `MARKETING_VERSION` (Xcode), `npm run check`, `npx cap sync`.
3. iOS: Xcode → Product → Archive → Distribute (TestFlight first).
4. Android: Android Studio → Build → Generate Signed Bundle (AAB) → Play
   Console internal testing first.
5. Smoke test on a device (TestFlight build): sign in, push permission,
   receive a chat push and tap it, report a message and block a member,
   scan a QR, open a member's website (system browser), check an unpaid
   member sees no checkout and the profile card has no billing buttons,
   delete a test account.

See the shell repo's README for the Xcode / Android Studio specifics,
signing, and screenshots.
