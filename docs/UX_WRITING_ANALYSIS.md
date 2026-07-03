# ThinkBiz Dashboard — UX Writing / Content Design Analysis & Improvements

_Date: 2026-06-24_

A UX Writer / Content Designer review of the words in the product: labels,
buttons, headings, helper text, and especially the system messages a member sees
after they act. Where earlier passes looked at how the product *looks* and
*behaves*, this pass looks at what it *says* — and whether the voice is
consistent, plain, and honest. Records the findings, what shipped, and a backlog.

## 1. How the analysis was framed

The voice the dashboard already sets is warm, plain, sentence-case and
second-person — "Welcome back, …", "Your ThinkBiz performance at a glance,"
"Monthly trends · last 12 months." The review audited the rest of the app
against that voice, with extra weight on the **weekly log** (the product's core,
most-repeated action) and on the **flash messages** members see after a write,
since those are the moments the product talks back. Four themes emerged, all
cases where the copy drifted from the established voice or leaked
implementation language.

## 2. Findings (prioritized)

### P0 — A successful action was styled as a warning (shipped)

`FlashMessage` infers its tone from the message text: it shows **yellow/warning**
when the text contains `"already"` or `"existing"`, and green/success otherwise.
The success message after attaching closed business to an existing log read
*"Closed business added to your **existing** log for this week"* — so a fully
successful save rendered in warning yellow with an info icon, reading as "something
needs your attention" when nothing did. The same coupling made the
already-logged notice shout with an exclamation: *"You have already submitted a
log for this week**!**"*

**Shipped:** reworded the success message to *"We added that closed business to
this week's log."* (drops the word "existing", so it now renders as the success
it is), and the already-logged notice to *"You have already logged this week — no
changes were made."* — calm, still correctly warning-toned via "already", and it
tells the member what actually happened to their submission.

### P1 — System messages used implementation language and a robotic voice (shipped)

The post-write messages spoke like a database, not like the rest of the product:

| Before | After |
|---|---|
| `Failed to insert log. Please try again.` | `Something went wrong and your log could not be saved. Please try again.` |
| `Log submitted successfully` | `Your log is saved.` |
| `Closed business added to your existing log for this week` | `We added that closed business to this week's log.` |

"Insert" is SQL, not something a member does; "submitted successfully" is
form-receipt language. The new copy is plain, active, and reassures the member
their numbers are safe — while preserving the tone-trigger words `FlashMessage`
keys on (the error keeps "could not", the warning keeps "already").

### P2 — Title Case and product jargon on the core action (shipped)

The dashboard speaks in sentence case, but the **weekly log form** — the screen
members touch most — was in Title Case throughout and carried networking-club
jargon, which a newer member has to decode:

- **Casing.** `Log Your Weekly Activity`, `Week Ending Date`, `Visitors
  Brought`, `1-on-1s Had`, `Referrals Given`, `Dollar Amount`, `Closed Business
  (Thank You)`, `Add Another Thank You`, `Submit Log` — all converted to sentence
  case to match the dashboard voice.
- **Clarity.** `1-on-1s Had` → `1-on-1s` ("Had" added nothing); `Dollar Amount`
  → `Amount`; the `Closed Business (Thank You)` header lost the parenthetical and
  its helper changed from the vague *"Record revenue generated from referrals"*
  to the concrete, action-first *"Thank a member for revenue you closed from
  their referral."*; `Add Another Thank You` → `Add another`.
- **Tone.** The intro *"Submit your stats for the week…"* became *"Add your
  numbers for the week…"* — "numbers" is the friendly term the empty state and
  dashboard already use ("ready for your first numbers").

### P3 — Inconsistent terminals: ellipsis and generic labels (shipped)

Small but pervasive inconsistencies that a content system should standardize:

- **Ellipsis.** The app mixed three-dot `...` and the typographic `…` — sometimes
  in the same file (`Select member...` next to `Submitting…` in the log form).
  Standardized the touched surfaces on the single `…` character (`Select a
  member…`, `Loading clubs…`, `Submitting…`).
- **Generic button labels.** The apply flow's final button just said `Submit`;
  now `Submit application` (says what it does). `Next Step` → `Next step`. The
  confirmation heading `Success!` (generic, exclamatory) → `Application
  received` (specific), with the body softened to *"Thanks for applying. A club
  director will review your details and be in touch soon."*
- **Option label.** `External/Visitor` → `External / visitor` (sentence case,
  spaced slash).

## 3. What shipped in this pass

| Change | Files |
|---|---|
| Post-write flash messages: fix false-warning styling, de-jargon, warmer active voice (tone-trigger words preserved) | `app/actions/submitLog.ts` |
| Weekly log form: sentence case throughout, clearer labels/helper, friendlier intro, standardized ellipsis | `components/WeeklyLogForm.tsx` |
| Apply flow: specific button labels, sentence case, clearer confirmation, standardized ellipsis | `app/apply/page.tsx` |

All changes are copy-only — no logic, data, or component-contract changes — and
were checked against `FlashMessage`'s tone inference so success/warning/error
styling stays correct. `npm run lint` is clean (0 errors; the 3 pre-existing
`<img>` warnings are untouched) and `npm run build` succeeds.

## 4. Backlog (recommended next, by priority)

1. **Adopt sentence case app-wide.** This pass converted the highest-traffic
   surfaces (log form, apply). The same Title-Case drift exists on other forms
   and headings; a documented "sentence case everywhere except proper nouns"
   rule plus a sweep would lock the voice in. Worth adding to `STYLE_GUIDE.md` as the
   one content rule the style guide currently lacks.
2. **Humanize the thrown-error strings.** `submitLogAction` / profile / onboarding
   still `throw new Error('User not authenticated')` and `'Member data not
   found'` — developer phrases that surface on the error boundary. Route these
   through a friendly error UI ("Your session expired — please sign in again.").
3. **Replace native `alert()` copy with inline validation.** Apply and the
   applications approve/deny buttons use blocking `window.alert()` with terse
   strings ("Please fill out all fields…", "An unexpected error occurred"). Inline
   field messages would be both better UX and a place for more specific,
   field-level guidance.
4. **Add field-level helper text to the log form.** First-timers may not know
   what counts as a "visitor" vs a "1-on-1." One-line hints under each field
   would reduce mis-entry and make the analytics cleaner.
5. **A short terminology/voice glossary.** Define the canonical member-facing
   terms once — "closed business", "1-on-1", "visitor", "log" (verb) — so future
   copy doesn't reintroduce "stats", "insert", "submit your data", etc.
