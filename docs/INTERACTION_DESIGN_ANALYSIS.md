# ThinkBiz Dashboard — Interaction Design Analysis & Improvements

_Date: 2026-06-24_

An Interaction Designer review of the app at the level of individual
interactions: how each control responds to input, the timing and presence of
feedback, keyboard and focus behavior, and how overlays (modals, menus) behave.
Where the Service Design pass looked at the journey _between_ screens, this pass
looks at the micro-moments _within_ a screen — the click, the keypress, the
half-second after a submit. Records the findings, what shipped, and a backlog.

## 1. How the analysis was framed

Good interaction design makes the system feel responsive and predictable:
every action gets immediate feedback, controls afford what they do, and
keyboard/assistive-tech users can do everything pointer users can. The review
audited every interactive surface — auth forms, the weekly log, profile,
director invites, chat (composer, channels, reactions), modals, and the mobile
menu — against three questions:

1. **Does every action give immediate feedback?** (no dead zone after a click)
2. **Do overlays behave the way users expect?** (Escape, focus, dismiss)
3. **Can a keyboard / screen-reader user operate it?**

The chat surface scored well already — `@`-mention autocomplete with full
arrow-key/Enter/Tab/Escape handling, optimistic reactions, and Enter-to-send /
Shift+Enter-for-newline are all in place. The gaps clustered in three areas.

## 2. Findings (prioritized)

### P0 — Server-action forms had no pending feedback (shipped)

The plain `<form action={serverAction}>` forms — **login**, **forgot password**,
**update password** — rendered a static submit button with no client state.
Between the click and the server's redirect (an auth round-trip that can take
several hundred ms on mobile data), the button stayed fully active and nothing
changed on screen. That dead zone is the classic cause of double submissions and
"did it work?" anxiety, and it lands on the very first interactions a new member
has with the product.

The richer client forms (profile, onboarding, director invite, weekly log) had
already solved this with `useTransition`/`useState`. This pass brings the
server-action forms up to the same bar.

**Shipped:** a reusable `SubmitButton` (`components/SubmitButton.tsx`) built on
`useFormStatus` — it disables itself, sets `aria-busy`, and swaps to a working
label ("Signing in…", "Sending link…", "Saving…") while the action runs. Applied
to login, forgot-password, and update-password, and the weekly log form was
refactored onto the same component so there's now one consistent submit
behavior across the app.

### P1 — Modals ignored Escape and didn't manage focus (shipped)

There were two separately hand-rolled overlays — the chat **browse/create
channel** modals and the **deny-application** confirmation — and both:

- closed only on a backdrop click (no <kbd>Escape</kbd>),
- never moved focus into the dialog or restored it to the trigger on close,
- didn't trap <kbd>Tab</kbd>, so focus silently escaped to the page behind,
- let the background scroll underneath, and
- exposed no `role="dialog"` / `aria-modal` / accessible name to assistive tech.

**Shipped:** a single accessible `Modal` (`components/Modal.tsx`) that handles
Escape-to-close, initial focus + focus restore, a `Tab` focus trap, body
scroll-lock, and proper `role="dialog"` / `aria-modal` / `aria-labelledby`
semantics with a labelled close button. Both the chat modals and the deny
confirmation now use it, which also unifies the previously inconsistent scrim
(`bg-black/40` vs `bg-black/60 backdrop-blur`). The deny dialog additionally now
guards against closing mid-request.

### P2 — Mobile menu was not keyboard- or expectation-friendly (shipped)

The mobile nav toggle exposed no accessible name, no `aria-expanded`, and no
`aria-controls`, so screen-reader users got an unlabeled button with no
open/closed state. The open menu also couldn't be dismissed with Escape or by
tapping outside it — only by reaching back to the toggle.

**Shipped:** the toggle now sets `aria-label`, `aria-expanded`, and
`aria-controls`; the panel has a matching `id`; Escape closes it; and a
transparent backdrop provides tap-outside-to-dismiss.

## 3. What shipped in this pass

| Change | Files |
|---|---|
| Reusable `useFormStatus` submit button (disabled + `aria-busy` + working label) | `components/SubmitButton.tsx` |
| Pending feedback on the auth forms | `components/login-form.tsx`, `app/forgot-password/page.tsx`, `components/update-password-form.tsx` |
| Weekly log form refactored onto the shared submit button | `components/WeeklyLogForm.tsx` |
| Accessible dialog primitive (Escape, focus trap + restore, scroll lock, dialog roles) | `components/Modal.tsx` |
| Chat + deny-application overlays refactored onto it | `components/chat/ChatApp.tsx`, `app/dashboard/applications/DenyButton.tsx` |
| Mobile menu: toggle a11y, Escape, tap-outside dismiss | `components/mobile-menu.tsx` |

All changes are additive and low-risk: no schema, API, or server-action contract
changes. `npm run lint` is clean (0 errors; the 3 remaining `<img>` warnings are
pre-existing and untouched) and `npm run build` succeeds.

## 4. Backlog (recommended next, by priority)

1. **Replace blocking `alert()` with inline feedback.** The apply form
   (`app/apply/page.tsx`) and the approve flow (`ApproveButton`) still use native
   `alert()` for validation and errors — a modal interruption that breaks flow and
   doesn't match the product. Inline, field-level errors (and an `aria-live`
   region) would be the consistent interaction model. (Also noted in the Service
   Design backlog.)
2. **Replace `window.confirm` for destructive chat actions.** Deleting a message
   and leaving a channel use the native confirm dialog; route them through the new
   `Modal` for a consistent, on-brand confirmation with managed focus.
3. **Associate form errors with their fields.** Validation messages
   (onboarding, profile, invite) render as standalone banners; wiring them to the
   offending input via `aria-describedby` and moving focus to the first error
   would tighten the keyboard/SR experience.
4. **Autosize the chat textarea.** It starts at one row and is manually
   resizable, but doesn't grow as the member types a multi-line message; growing
   to fit (up to the max height) is the expected behavior.
5. **Reduced-motion + focus-visible audit.** Honor `prefers-reduced-motion` for
   the hover-lift/translate transitions, and confirm a visible focus ring on every
   interactive element (some icon buttons rely on hover only).
