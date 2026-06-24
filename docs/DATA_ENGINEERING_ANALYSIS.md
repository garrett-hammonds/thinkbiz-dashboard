# ThinkBiz Dashboard — Data Engineering Analysis & Improvements

_Date: 2026-06-24_

A Data Engineer review of the app's data layer: schema, access patterns, query
efficiency, integrity, and how data moves between Postgres (Supabase), the
server, and the client. Records the findings, what shipped in this pass, and a
prioritized backlog.

## 1. Data model overview

Core business tables (baseline schema, predating the migration history):

- **`members`** — people; `auth_user_id` links to Supabase Auth, `current_club_id`
  to their club, `is_active`, `is_admin`, `club_director`.
- **`clubs`** — networking clubs.
- **`weekly_logs`** — one row per member per week: `member_id`, `club_id`,
  `week_ending`, `visitors_brought`, `one_on_ones_had`, `referrals_given`,
  `created_at`. A unique `(member_id, week_ending)` constraint enforces one log
  per week (relied on in `submitLogAction`).
- **`closed_business_thanks`** — referral revenue events: `thanking_member_id`,
  `thanked_member_id` (nullable for external), `weekly_log_id`, `revenue_amount`,
  `created_at`.

Feature tables added by migrations: chat (`chat_channels`, `chat_messages`,
`chat_channel_members`, `chat_message_reactions`) and notifications
(`notification_preferences`, `push_subscriptions`). These are well-modeled —
RLS via `SECURITY DEFINER` helpers, sensible indexes (e.g.
`chat_messages (channel_id, created_at DESC)`), `ON DELETE CASCADE`, unique
endpoints, and idempotent `to_regclass`-guarded migrations. No changes needed
there.

## 2. Findings (prioritized)

### P0 — Hot read paths run without supporting indexes (shipped)

The most-hit queries filter/join on columns with no guaranteed index (only the
baseline schema's indexes exist on `weekly_logs` / `closed_business_thanks`):

| Query | Where | Frequency |
|---|---|---|
| `weekly_logs WHERE club_id = ?` | dashboard club view | every dashboard load |
| `closed_business_thanks JOIN weekly_logs ON weekly_log_id`, filtered by `club_id` | dashboard club revenue | every dashboard load |
| `closed_business_thanks WHERE thanking_member_id = ?` | dashboard personal revenue | every dashboard load |
| `weekly_logs WHERE week_ending >= cutoff` | weekly cron reminder | weekly, **full-table scan** |

As clubs accumulate weekly logs across all members over multiple years, each of
these degrades linearly. The cron's `week_ending` filter is the worst — a full
scan of the entire `weekly_logs` table every Friday.

**Shipped:** `supabase/migrations/20260624_dashboard_performance.sql` adds
`weekly_logs(club_id)`, `weekly_logs(week_ending)`,
`closed_business_thanks(thanking_member_id)`, and
`closed_business_thanks(weekly_log_id)`. Idempotent and guarded, consistent with
existing migrations. `weekly_logs(member_id)` is deliberately omitted — the
existing unique `(member_id, week_ending)` index already serves member-scoped
lookups, and a duplicate would only add write overhead.

> **Operational note:** like the other migrations in this repo, this must be
> applied manually (`supabase db push` or the SQL editor). It is additive and
> safe to run on a live database.

### P1 — Dashboard over-fetches columns (shipped)

`app/dashboard/page.tsx` read `weekly_logs` with `select('*')` for both the
personal and club queries, pulling every column (`id`, `member_id`, `club_id`,
`referrals_given`, …) when the scorecards and charts only use four. Switched to
an explicit `visitors_brought, one_on_ones_had, week_ending, created_at`
projection, and relaxed `WeeklyLog.referrals_given` to optional so the type
matches what's actually fetched. The revenue queries were already projected.

### P2 — Aggregation happens in the app, not the database (recommended next)

This is the larger architectural item. The dashboard fetches **raw rows** —
every personal log, every club log, every revenue event, all-time — and sums
them in JavaScript (`Scorecards`, `DashboardCharts`). The club query in
particular returns an unbounded set (all logs for all members of the club, for
all time) on every page load. Indexes (P0) speed up *finding* the rows, but the
volume of data crossing the wire and the server-side reduce work still grow
without bound.

The right fix is to push the aggregation into Postgres and return compact
rollups. Staged here rather than shipped because the SQL can't be executed
against a real database in this environment, and routing members' live business
metrics through unverified SQL is not worth the risk — see the design below.

## 3. Recommended: `dashboard_metrics()` RPC (design)

A `SECURITY DEFINER` function resolving the caller via `auth.uid()` (same
pattern as `chat_unread_counts()`), returning JSON with pre-aggregated personal
and club metrics:

```jsonc
{
  "personal": {
    "total_revenue": 0, "total_visitors": 0,
    "total_one_on_ones": 0, "members_thanked": 0,
    "monthly": [ { "ym": "2026-06", "revenue": 0, "visitors": 0,
                   "one_on_ones": 0, "thanked": 0 } ]   // trailing 12 months
  },
  "club": { "name": "...", /* same shape, or null if no club */ }
}
```

Rollout plan:
1. Add the function in a migration and apply it.
2. **Validate** the RPC's numbers against the current in-app aggregation for a
   few real members/clubs (the totals are simple `SUM`/`COUNT`; the monthly
   series buckets logs by `week_ending` and revenue by `created_at`, matching
   the current client logic).
3. Switch the dashboard to call the RPC, keeping the existing raw-row path as a
   graceful fallback when the function is absent (mirroring how the navbar
   degrades when `chat_unread_counts` isn't deployed).

Expected impact: dashboard payload drops from O(all rows) to ~24 small rows
(12 months × personal + club), and the reduce work moves to indexed Postgres
aggregates.

## 4. Backlog (after the RPC)

1. **De-duplicate the per-request member fetch.** `getMemberForUser` runs
   `select('*')` on `members`, and it's called twice per request (navbar + page).
   Wrap it in React `cache()` (keyed on the auth user id, creating its own
   client) to collapse it to one read per request.
2. **`closed_business_thanks` revenue date.** Revenue is bucketed by `created_at`
   (when it was entered) rather than the activity week. If "revenue by activity
   week" is the intended semantic, bucket via the joined `weekly_logs.week_ending`
   — fold this into the RPC.
3. **Server-side validation / constraints on writes.** `submitLogAction` accepts
   `week_ending`, counts, and `revenue_amount` with minimal bounds (only `> 0`).
   Consider `CHECK` constraints (non-negative counts, sane revenue ceiling) and
   rejecting far-future `week_ending` values, so the analytics tables can't be
   polluted by bad input.
4. **Read-state write amplification.** Chat marks channels read by updating
   `last_read_at`; confirm this is debounced/batched so active channels don't
   generate a write per message viewed.
```
