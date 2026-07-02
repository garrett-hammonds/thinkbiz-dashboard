# Meeting attendance — setup & how it works

Weekly meeting attendance is tracked with **member check-in QR codes**: every
member has a permanent personal QR code, and the club director scans it with
the in-app scanner as members arrive. A manual roster checklist covers dead
phones, moved meetings, and weeks when nobody could scan.

## 1. Apply the migration

Run `supabase/migrations/20260702000300_club_attendance.sql` in the Supabase
SQL editor (or `supabase db push`). It adds:

- `clubs.meeting_day` — the weekday the club meets (0=Sunday..6=Saturday,
  JS `Date#getDay` convention). NULL until a director sets it on
  `/dashboard/attendance`.
- The `attendance` table — one row per member per weekly meeting slot,
  `source` is `'scan'` (door scanner) or `'manual'` (checklist/backfill).
- The `attendance_can_manage()` helper and RLS policies. Attendance is
  director/admin-only in both directions; regular members never read it.

## 2. Environment

One **optional** variable: `CHECKIN_QR_SECRET` — the HMAC key that signs each
member's check-in token. When unset it falls back to the existing
`DIRECTOR_INVITE_SECRET` (the two token families stay distinct via their
issuer/audience claims), so existing deployments need **no new configuration**.

> Rotating whichever secret is in use invalidates every member's QR code at
> once (members just reopen `/check-in-code` — screenshots of the old code
> stop working).

The scanner and roster reads use the existing `SUPABASE_SERVICE_ROLE_KEY`
after code-side director/admin gating, same as the roster page.

## How check-in works

1. A director opens `/dashboard/attendance` and sets the club's **meeting
   day** (one-time).
2. Each member's personal code lives at `/check-in-code` ("Check-In" in the
   nav). It's a signed JWT of their member id — permanent, so a screenshot or
   printed card works. It grants nothing by itself: every scan re-verifies,
   at scan time, that the member is active and belongs to the scanning
   director's club, so removing a member instantly kills their code.
3. At the door the director opens `/dashboard/attendance/scan` and points the
   camera at each arriving member's code. The scanner uses the native
   `BarcodeDetector` where available (Chrome/Android) and falls back to
   `jsqr` elsewhere (iOS Safari). Each successful scan flashes the member's
   name and headshot so the director confirms the face matches.
4. A scan on any day counts toward the **nearest occurrence of the meeting
   day** (±3 days), so moved meetings, past-midnight meetings, and server
   timezone skew all land in the right weekly slot.
5. Re-scanning someone the same week is a friendly no-op ("already checked
   in").

## Manual fallback / backfill

`/dashboard/attendance` is a tap-to-toggle checklist of the club's active
members for any week (navigate with Previous/Next). If the director is out,
someone takes paper attendance and the director backfills it here later.
Manual marks and scans are distinguished by the `source` column and a
"Scanned in" badge.

## Dashboard

Directors and admins see a **Meeting attendance** section under their club's
stats on `/dashboard`: this week's count and rate ("18 of 24 · 75%") plus a
12-week trend chart. Regular members don't see club attendance numbers.
Admins can view any club's attendance via the existing club switcher.
