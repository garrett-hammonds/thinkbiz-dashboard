# ThinkBiz Dashboard — TPM Analysis & Improvements

_Date: 2026-06-24_

A Technical Product Manager review of the member dashboard, framed around the
product's core job-to-be-done and the health of the primary user loop. This doc
records what the app does, the issues found, how they were prioritized, what was
shipped in this pass, and the remaining backlog.

## 1. Product context

ThinkBiz is a membership app for a referral-networking organization (BNI-style
clubs). Members belong to a **club** and the product's core loop is:

> **log weekly activity** (visitors brought, 1-on-1s, referrals given, closed
> business / "thank-yous") → **see personal + club performance** on a dashboard.

Supporting flows already exist and are reasonably mature: application →
approval → onboarding, director invites, a member roster, club chat, and a
notifications stack (email via Resend + web push, weekly-log reminders via
Vercel Cron, chat alerts via a Supabase webhook). Recent history shows SRE
hardening and build cleanup, so the platform is past MVP.

## 2. How the analysis was framed

The dashboard and the weekly log _are_ the product. Most members will never
touch director/admin surfaces, but every active member is expected to log and
review numbers regularly. So the review weighted two things heavily:

1. **Integrity of the core loop** — can a member log activity and trust what the
   dashboard shows them back?
2. **Feedback quality** — does the product confirm the member's actions?

## 3. Findings (prioritized)

### P0 — Submission feedback was invisible (shipped)

`submitLogAction` redirects to `/dashboard?message=…` or `/log?message=…` for
all six of its outcomes — success, "already logged this week", closed business
attached to an existing log, and two failure paths. **Neither page read
`searchParams`**, so the message was silently dropped. A member submitting their
weekly numbers — the single most important action in the app — got *no*
confirmation, and the two error paths (insert failed, closed business could not
be recorded) were completely invisible. The login / password pages already
render their `?message=`, so the pattern existed but the core pages didn't use
it.

**Impact:** erodes trust in the primary action; members can't tell a success
from a silent failure; likely drives duplicate submissions and support pings.

### P1 — Charts collapsed data across years (shipped)

`dashboard-charts.tsx` bucketed every datapoint by **month name only**
(`toLocaleString({ month: 'short' })`) into a fixed Jan–Dec axis. Two
consequences:

- Activity from different years (e.g. Jun 2025 and Jun 2026) **summed into the
  same bar**, overstating recent performance.
- The axis always showed all 12 months regardless of when the member actually
  joined or logged, so a new member saw a misleadingly "full" year.

Weekly logs were also bucketed by `created_at` (submission time) rather than
`week_ending` (the week the activity covers), so a late entry landed in the
wrong month.

**Impact:** the dashboard's headline trends were quantitatively wrong for any
member with more than ~12 months of history — directly undermining the
product's reason to exist (trustworthy performance tracking).

### P2 — No timeframe context on the dashboard (partially shipped)

Scorecards are all-time cumulative totals and the charts had no stated window,
so "your performance at a glance" gave no sense of _over what period_. Added a
"last 12 months" label to the trends section; scorecards remain all-time (see
backlog for a per-period toggle).

## 4. What shipped in this pass

| Change | Files |
|---|---|
| Reusable, dismissible `FlashMessage` banner that renders `?message=`, infers tone (success / warning / error) from the text, and strips the param from the URL so a refresh doesn't replay it | `components/FlashMessage.tsx` |
| Surface submission feedback on the dashboard and the log page | `app/dashboard/page.tsx`, `app/log/page.tsx` |
| Rolling **trailing-12-month** chart window, keyed by **year + month** (no cross-year collapsing), bucketing weekly logs by `week_ending` rather than submission time | `components/dashboard-charts.tsx` |
| Add optional `week_ending` to the shared `WeeklyLog` type | `lib/types/metrics.ts` |
| Explicit "last 12 months" heading on the trends section | `app/dashboard/page.tsx` |

All changes are additive and low-risk: no schema migration, no API/contract
changes. `npm run lint` is clean (0 errors; remaining `<img>` warnings are
pre-existing) and `npm run build` succeeds.

## 5. Backlog (recommended next, by priority)

1. **Per-period scorecards** — add a "this month / this quarter / all-time"
   toggle so the headline numbers carry a timeframe, matching the charts.
2. **Audit other server actions for dropped feedback** — apply the same
   `FlashMessage` treatment to profile updates, approve/deny, director invites,
   and onboarding, several of which redirect without surfacing a result.
3. **Optimistic / inline form feedback on the log form** — the form posts and
   redirects; a pending state and inline validation would tighten the loop
   further (e.g. disable submit while saving).
4. **Revenue bucketing by activity week** — closed business is currently bucketed
   by `created_at`; join through `weekly_logs.week_ending` for full consistency
   with the other series.
5. **Empty-state for new members** — when a member has zero logs, the dashboard
   shows empty charts and $0 scorecards; a guided empty-state would convert
   better than blank bars.
6. **Replace placeholder PWA icons** (already tracked in
   `docs/NOTIFICATIONS_SETUP.md`).
