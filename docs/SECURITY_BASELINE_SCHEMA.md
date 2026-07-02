# Capturing the baseline schema + RLS into source control

## Why this matters (security)

The core tables — `members`, `clubs`, `pending_applications`, `weekly_logs`,
`closed_business_thanks`, and the standalone `admins` table — were created
directly against the production Supabase project and were **never committed as
migrations**. Only later feature tables (chat, notifications, visitors, billing
columns) are versioned under `supabase/migrations/`.

Consequences:

- **Unauditable authorization.** The RLS policies that decide who can read/write
  `members` (and therefore who is admin, who has paid, etc.) can't be reviewed
  from the repo. Security review has to trust the live DB.
- **Non-reproducible environments.** A fresh Supabase preview branch spins up
  with none of the baseline schema, so the guarded migrations (`to_regclass`
  checks) silently no-op and the app can't run there.
- **Drift risk.** Nothing pins the live policies; a manual dashboard edit can
  weaken them without any diff.

This is why the `members` column-lock trigger
(`supabase/migrations/20260702000100_lock_members_privileged_columns.sql`) is a
belt-and-suspenders defense: it holds regardless of what the live UPDATE policy
turns out to be. Capturing the baseline closes the audit gap for good.

## How to capture it

This requires access to the live database (the Supabase MCP with approval, the
dashboard SQL editor, or `psql` with the connection string). Run the extraction,
review the output, and commit it as a new migration.

### Option A — `pg_dump` (most faithful)

```bash
# Schema only (no data), public schema, restricted to the baseline tables.
pg_dump "$SUPABASE_DB_URL" \
  --schema-only --no-owner --no-privileges \
  --schema=public \
  --table=public.members \
  --table=public.clubs \
  --table=public.pending_applications \
  --table=public.weekly_logs \
  --table=public.closed_business_thanks \
  --table=public.admins \
  > supabase/migrations/20260701000000_baseline_core_schema.sql
```

`pg_dump` includes `CREATE TABLE`, indexes, constraints, and — because RLS is
table state — the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and
`CREATE POLICY` statements. Wrap the file in the same `to_regclass` /
`IF NOT EXISTS` guards the other migrations use if you want it replayable on
environments that already have the tables.

### Option B — query the catalog (when pg_dump isn't available)

Inspect the policies directly, then hand-write the migration from the output:

```sql
-- All RLS policies on the baseline tables
select schemaname, tablename, policyname, roles, cmd,
       pg_get_expr(qual, polrelid)        as using_expr,
       pg_get_expr(with_check, polrelid)  as check_expr
from pg_policies
join pg_policy      on pg_policy.polname = pg_policies.policyname
join pg_class       on pg_class.oid = pg_policy.polrelid
where schemaname = 'public'
  and tablename in ('members','clubs','pending_applications',
                    'weekly_logs','closed_business_thanks','admins');

-- Column-level privileges granted to the client roles (verifies the P1 concern)
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'members'
  and grantee in ('authenticated','anon')
order by column_name;
```

## While you're in there: verify the P1 escalation

Confirm whether the `members` UPDATE policy actually allowed privileged-column
writes before the guard trigger. As a normal (non-admin) member, with only the
anon key + that member's session:

```bash
curl -X PATCH \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/members?auth_user_id=eq.<self-uuid>" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer <member-access-token>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"is_admin": true}'
```

After the trigger migration is applied this must fail with
`insufficient_privilege` ("Updating members.is_admin is not permitted…").

## Resolve the dual admin source of truth

There are two places a person can be "admin":

- `members.is_admin` — what the **application actually reads** everywhere.
- a standalone `admins` table (one row, per `docs/DATA_ENGINEERING_ANALYSIS.md`).

Pick one authority. Recommended: standardize on `members.is_admin` (no code
change needed), migrate any `admins`-only entries onto `members.is_admin`, and
drop the `admins` table so it can't drift out of sync with the enforced source.
