# ThinkBiz Dashboard — Data Engineering Analysis & Improvements

_Date: 2026-06-24 · **verified against the live Supabase project** (`ThinkBiz
Dashboard App`, ref `basrdqwpynzaepmhdbze`, Postgres 17.6, region us-west-2)._

A Data Engineer review of the app's data layer, this pass grounded in the actual
database rather than inferred from code. Schema, row counts, access patterns,
integrity, and data movement between Postgres, the server, and the client.

> **Connectivity note:** the Supabase MCP connection was live long enough to pull
> the full schema and row counts (the basis for the recalibration below), then
> dropped before I could run the security/performance **advisors**, enumerate
> **existing indexes**, **apply** the index migration, or **validate** a
> server-side aggregation RPC. Those four steps are marked _pending reconnection_
> and are the remaining live-DB work.

## 1. What the live database actually contains

The Supabase project backs **more than this repo** — alongside the membership
app there's a CMS, blog, events, and a club-seat directory (likely a separate
marketing front-end sharing the same database). Full `public` inventory with
live row counts:

| Table | Rows | Notes |
|---|---:|---|
| `club_seats` | 380 | largest table; seat/industry directory |
| `weekly_logs` | **266** | core metric table |
| `members` | 85 | |
| `industries` | 95 | reference data |
| `closed_business_thanks` | **50** | revenue events |
| `chat_*` | 0–6 | chat barely used yet |
| `pending_applications` | 6 | |
| `page_versions` / `pages` | 8 / 3 | CMS |
| `blog_posts` / `authors` | 3 / 2 | blog |
| `notification_preferences` / `push_subscriptions` | 1 / 1 | notifications just launched |
| `events` | 0 | |

The schema confirmed every column assumption from the prior (code-only) pass:
`weekly_logs(member_id, club_id, week_ending date NOT NULL, visitors_brought,
one_on_ones_had, referrals_given, created_at)` and
`closed_business_thanks(weekly_log_id NOT NULL, thanking_member_id NOT NULL,
thanked_member_id, revenue_amount numeric, created_at)`. RLS is enabled on all
public tables.

## 2. Scale reality check (the headline correction)

Seeing the data changes the conclusion. The prior pass — written without DB
access — flagged the dashboard/cron read paths as a **P0 performance risk**. At
the **actual** volumes (266 weekly logs, 50 revenue rows, 85 members), that
urgency does not hold: Postgres scans a 266-row table in well under a
millisecond, and the dashboard's "fetch all rows and aggregate in JS" pattern is
completely fine at this size. **Nothing here is a performance problem today.**

A data engineer calibrates to real scale, so the recommendations are re-graded:

- The work is now **future-proofing**, not firefighting. It matters at ~10k–100k+
  `weekly_logs` (years of weekly logging across many clubs), not at 266.
- The index migration is still worth keeping because it is **near-zero cost** and
  removes the future seq-scan cliff — but it is no longer "urgent," and it should
  be applied only after confirming the indexes don't already exist (see §4).
- The server-side aggregation RPC is now explicitly **deferred** as premature
  optimization. Re-evaluate when `weekly_logs` is in the tens of thousands.

This recalibration is the main value of redoing the analysis against the live DB.

## 3. Integrity findings (new, from the live schema)

These are correctness/consistency observations that only surface from the real
schema, and matter more than raw performance at this stage:

1. **Dual source of truth for admin.** There is a standalone `admins` table
   (`user_id → auth.users`, 1 row) **and** a `members.is_admin` boolean. The app
   code reads `members.is_admin` (navbar, getMember). If both exist, they can
   drift — someone in `admins` but not flagged on `members` (or vice versa) gets
   inconsistent access. Recommend picking one authority and deriving the other
   (e.g. a view or a sync trigger), or documenting which one wins.
2. **`weekly_logs.club_id` is nullable.** Logs can exist with no club. The
   dashboard's club rollup and the directory silently exclude them; for org-wide
   analytics those rows would be invisible. Confirm whether a null club is valid
   (e.g. a member between clubs) or should be backfilled.
3. **No `CHECK` constraints on metric ranges.** `visitors_brought`,
   `one_on_ones_had`, `referrals_given` default 0 but accept any int;
   `revenue_amount` accepts any numeric. `submitLogAction` only filters
   `revenue_amount > 0`. Cheap `CHECK (… >= 0)` guards would keep the analytics
   tables clean at the source.

## 4. Pending live-DB steps (blocked by the dropped connection)

To finish the DB-grounded pass, run these when Supabase is reconnected:

1. **`get_advisors` (security + performance).** Surfaces unindexed foreign keys,
   RLS gaps, and `SECURITY DEFINER` functions missing a pinned `search_path`
   (the chat/notif helpers set it; worth confirming nothing else is flagged).
2. **Enumerate existing indexes** (`pg_indexes` for `weekly_logs` /
   `closed_business_thanks`) to confirm the unique `(member_id, week_ending)`
   constraint exists and that the four proposed indexes aren't already present
   before applying the migration.
3. **Apply** `20260624_dashboard_performance.sql` via `apply_migration` (cheap,
   additive) once §4.2 confirms it's non-redundant.
4. **Validate** a `dashboard_metrics()` RPC against the current in-app totals on
   real data — but only when scale justifies building it (§2).

## 5. Shipped in this work (code-side, scale-independent)

These remain valid regardless of scale and are already committed:

- **`supabase/migrations/20260624_dashboard_performance.sql`** — indexes on
  `weekly_logs(club_id)`, `weekly_logs(week_ending)`,
  `closed_business_thanks(thanking_member_id)` and `(weekly_log_id)`. Idempotent
  and guarded. Kept as cheap future-proofing; **not yet applied** (pending §4).
- **Narrowed dashboard over-fetching** — the two `weekly_logs` reads went from
  `select('*')` to the four columns the scorecards/charts use; `WeeklyLog`'s
  `referrals_given` relaxed to optional to match. Pure hygiene, no behavior
  change, sensible at any scale.

## 6. Re-prioritized backlog

1. **Resolve the dual admin source of truth** (§3.1) — integrity > performance
   here.
2. **Add `CHECK` constraints** on metric/revenue columns (§3.3).
3. **Run advisors and act on findings** (§4.1) once reconnected.
4. **De-duplicate the per-request member fetch** — `getMemberForUser` runs
   `select('*')` on `members` twice per request (navbar + page); wrap in React
   `cache()`. Cheap win, scale-independent.
5. **Defer** the `dashboard_metrics()` aggregation RPC until `weekly_logs` grows
   ~2 orders of magnitude (§2).
