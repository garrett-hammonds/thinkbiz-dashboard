# ThinkBiz Dashboard — Service Design Analysis & Improvements

_Date: 2026-06-24_

A Service Designer review of the member experience end-to-end: the journey from
application to active weekly use, the quality and consistency of feedback at
each touchpoint, the state of the product when it has no data yet, and whether
every surface feels like the same service. Records the findings, what shipped in
this pass, and a prioritized backlog.

Prior passes covered the TPM lens (integrity of the core loop, chart
correctness) and the Data Engineering lens (indexes, over-fetching). This pass
deliberately looks at the _seams between screens_ rather than any single feature.

## 1. The member journey

```
apply  →  (director approves)  →  invite email  →  set password  →
onboarding (confirm profile)  →  DASHBOARD  ⇄  weekly LOG  →  chat / roster
```

The **dashboard ⇄ log** loop is the heart of the service: a member logs a week of
activity and sees their performance reflected back. Everything else
(application, onboarding, chat, roster, notifications) exists to get members into
that loop and keep them there. The review weighted the moments that make or break
that loop: the **first run** (does a new member understand what to do?) and the
**core action** (is logging frictionless and trustworthy?).

## 2. Findings (prioritized)

### P0 — The first-run dashboard is an empty dead end (shipped)

A member who has just finished onboarding lands on `/dashboard` with zero weekly
logs. The page rendered four **$0 scorecards** and four **empty bar charts** —
the product's primary surface looking broken at the single most important moment
of the journey, first impression. There was a `GettingStartedBanner` nudging
toward the checklist, but the metrics area itself offered no explanation and no
path forward; a new member sees blank graphs and is left to guess whether the app
is broken, still loading, or simply empty.

**Shipped:** a guided `DashboardEmptyState` that replaces the personal
scorecards and trend charts whenever the member has no logs **and** no revenue.
It explains what the dashboard will become, previews the four metric categories,
and offers a single primary action — **"Log my first week"** → `/log`. The full
metrics UI returns automatically as soon as the first log exists. (This closes
TPM backlog item #5.)

### P1 — Friction and data-integrity gaps in the core action (shipped)

The weekly log form is the most-used write in the product. Several small things
worked against the member:

- **Number fields were pre-filled with `0`.** Visitors / 1-on-1s / referrals all
  rendered a literal `0` the member had to select and delete before typing a real
  value — friction on every field, every week. Now they start empty with a `0`
  placeholder, so the common "I brought 2 visitors" path is just "type 2".
- **No pending state on submit.** The form posts to a server action and redirects;
  during that round-trip the button stayed fully active, inviting a second click
  and a confusing double submission. Submit now reports its own pending state
  (`useFormStatus` → disabled + "Submitting…").
- **`week_ending` accepted arbitrarily far-future dates.** A mis-typed year (e.g.
  2027) would silently land activity outside every dashboard window and pollute
  club analytics. The date input is now capped at **today + 7 days** — enough to
  log the current week (whose ending date may be a few days out) but no further.
- **The remove-thank-you control was a literal letter `"X"`.** Replaced with a
  proper icon button carrying an `aria-label` ("Remove thank-you entry N").

### P2 — Inconsistent visual language across touchpoints (partially shipped)

The service is mostly on-brand, but a few surfaces diverged, which subtly erodes
the sense that it's one coherent product:

- **The log form used an undefined token vocabulary** (`bg-card`, `bg-input`,
  `ring-ring`, `text-card-foreground`). `--color-input` is not defined in
  `globals.css`, so `bg-input` generated no rule and the fields fell back to a
  transparent background — visibly different from the `border-gray-300` inputs on
  the apply, profile, and onboarding forms. Standardized the form on the
  documented brand input style so all member-facing forms match.
- **The access-denied recovery page used off-brand blue** (`bg-blue-600`,
  `focus:ring-blue-500`) instead of the teal `primary`. A member who hits a
  permission wall should still feel they're inside ThinkBiz. Switched to the
  brand primary button and card styling per `CLAUDE.md`.

## 3. What shipped in this pass

| Change | Files |
|---|---|
| Guided first-run empty state shown when a member has no logs or revenue, with a single "Log my first week" CTA | `components/DashboardEmptyState.tsx`, `app/dashboard/page.tsx` |
| Weekly log form: empty number fields with `0` placeholder, `useFormStatus` pending state on submit, far-future `week_ending` cap, icon-based remove control, brand-aligned inputs | `components/WeeklyLogForm.tsx` |
| Brand-consistent access-denied recovery page (teal primary, card surface) | `app/access-denied/page.tsx` |

All changes are additive and low-risk: no schema migration, no API/contract
changes, no change to the data the server action receives (empty number fields
still submit as `0` via the action's existing `|| '0'` fallback). `npm run lint`
is clean (0 errors; the remaining `<img>` warnings are pre-existing and not in
the files touched here) and `npm run build` succeeds.

## 4. Backlog (recommended next, by priority)

1. **Replace `alert()` with inline, on-brand validation.** The apply form
   (`app/apply/page.tsx`) and the approve flow (`ApproveButton`) use native
   `alert()` for errors — jarring and off-brand, and on apply the validation only
   fires when the member clicks "Next". Inline field-level errors would match the
   profile form's pattern and read as part of the product.
2. **Unify the feedback mechanism.** Three patterns coexist: the `?message=`
   `FlashMessage` banner (log/dashboard), an inline state banner (profile form),
   and `alert()` (apply/approve). Converging on the `FlashMessage` banner — or a
   shared toast — would make "the app confirming your action" feel consistent
   everywhere.
3. **Prefill `week_ending` with the current week's ending date.** Capping the
   future is the safe half; defaulting to the expected value (the upcoming/most
   recent Friday) would remove a manual step entirely for the common case.
4. **Empty state for the club section.** The personal empty state ships here; a
   brand-new club (or a member whose club has no logs yet) still sees empty club
   charts. Lower frequency, same treatment.
5. **Confirmation + summary after logging.** Today a successful submit redirects
   to the dashboard with a one-line flash. A short "here's what you logged"
   confirmation (week, totals, revenue recorded) would close the loop more
   visibly and build trust in the numbers.
6. **Accessibility sweep.** Spot checks were good (the FlashMessage uses
   `role="status"`, the checklist buttons set `aria-expanded`), but a full pass on
   focus order, color contrast on muted text, and form error association
   (`aria-describedby`) would harden the service for all members.
