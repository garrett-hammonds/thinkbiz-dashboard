# ThinkBiz Dashboard — Visual Design Analysis & Improvements

_Date: 2026-06-24_

A Visual Designer review of the app's aesthetic surface: brand-palette fidelity,
color, elevation/shadow, and consistency against the `STYLE_GUIDE.md` style guide.
Where the Service Design pass looked at the journey and the Interaction Design
pass looked at behavior, this pass looks at how the product _looks_ — and whether
what's on screen matches the brand system it claims to follow. Records the
findings, what shipped, and a backlog.

## 1. How the analysis was framed

`STYLE_GUIDE.md` is the brand source of truth. Its rules are explicit: a teal /
navy / gold palette, "**Do not guess hex codes — always use the semantic
Tailwind configuration colors**," navy for "Secondary," and a soft teal-tinted
`shadow-card` for elevated cards. The review audited the rendered UI against that
guide and against itself (do equivalent components look the same everywhere?).
Three issues stood out, all of them cases where the implementation silently
diverged from the documented system.

## 2. Findings (prioritized)

### P0 — "Secondary" was mapped to light gray, breaking every primary button's hover (shipped)

`STYLE_GUIDE.md` defines **Secondary = Navy Blue** and specifies the primary button as
`bg-primary … hover:bg-secondary` — i.e. a teal button that **darkens to navy**
on hover. But `globals.css` mapped `--secondary: #f0f2f5` (a near-white gray).
The consequences were app-wide and very visible:

- **~25 primary CTAs** — login, apply, onboarding, profile, invite, chat,
  weekly log, the new empty-state and password forms — all used
  `bg-primary text-white hover:bg-secondary`. On hover they went from teal to
  **near-white with white text**: the label all but disappeared.
- **Navy accents read as gray.** Badges and avatars built as
  `bg-secondary/10 text-secondary` (the roster "Director" badge, the checklist
  "Optional" badge, chat avatar initials) and `hover:text-secondary` links
  rendered in gray instead of the intended navy.

An audit of every `secondary` usage in the codebase found **none** that treat it
as a light surface — light grays are always `muted` (`#f0f2f5`). So the token was
simply wrong.

**Shipped:** `--secondary` → `#086788` (brand navy) and `--secondary-foreground`
→ white. One token change repairs the hover state of every primary button and
restores the navy accents everywhere, with no markup changes. (White on
`#086788` clears WCAG AA.)

### P1 — The dashboard used an off-brand Material Design palette (shipped)

The scorecards and the four trend charts — the product's core surface — colored
their metrics with `#4CAF50`, `#2196F3`, `#9C27B0`, `#FF9800`: stock Material
Design green/blue/purple/orange, sharing nothing with the ThinkBiz palette and
directly contradicting the "don't guess hex codes" rule. The same four literals
were duplicated across both files.

**Shipped:** a single shared `lib/chartColors.ts` defining a **brand-derived**
metric palette — navy / teal / mid-teal / gold, points on the brand teal→navy
ramp plus the gold accent — consumed by both the scorecards and the charts so a
metric's color is defined once and always agrees across surfaces. The dashboard
now reads as ThinkBiz rather than as a generic admin template.

### P2 — Inconsistent and partly broken card elevation (shipped)

The brand card is `shadow-card` (a soft teal-tinted shadow), and several cards
declared `hover:shadow-card-hover hover:-translate-y-[2px]` for a lift on hover —
but **`--shadow-card-hover` was never defined**, so those cards moved up on hover
with *no* change in shadow (a lift that looks like a rendering glitch). Meanwhile
the dashboard scorecards used a generic `shadow-sm … hover:shadow-md`, a
different elevation language from the rest of the app.

**Shipped:** defined `--shadow-card-hover` (a deeper, stronger teal-tinted
elevation) so every `hover:shadow-card-hover` across the app (Support cards,
Applications cards) now actually lifts; and moved the scorecards onto the brand
`shadow-card` / `shadow-card-hover` pair so dashboard cards match the rest of the
product. Chart cards were aligned to the `shadow-card` base.

## 3. What shipped in this pass

| Change | Files |
|---|---|
| `--secondary` → brand navy, `--secondary-foreground` → white; defined the missing `--shadow-card-hover` elevation token | `app/globals.css` |
| Shared brand-derived metric palette replacing the Material Design hexes | `lib/chartColors.ts`, `components/scorecards.tsx`, `components/dashboard-charts.tsx` |
| Scorecards/chart cards moved onto the brand `shadow-card` / `shadow-card-hover` elevation | `components/scorecards.tsx`, `components/dashboard-charts.tsx` |

All changes are token- and class-level: no schema, API, or component-contract
changes, and no markup restructuring. `npm run lint` is clean (0 errors; the 3
remaining `<img>` warnings are pre-existing and untouched) and `npm run build`
succeeds.

## 4. Backlog (recommended next, by priority)

1. **Standardize page-title typography.** Page `<h1>`s vary across the app —
   `text-2xl font-bold tracking-tight` (dashboard, getting-started) vs `text-3xl`
   (apply, profile) vs `text-4xl font-black` (support). `STYLE_GUIDE.md` defines a
   single H1–H4 scale; adopting it consistently (ideally via a small `<PageTitle>`
   component) would give every screen the same masthead weight.
2. **Promote the brand tokens into a documented primitive set.** Two vocabularies
   coexist — shadcn-style (`bg-card`, `text-muted-foreground`, `border-border`)
   and brand (`bg-white`, `text-gray-500`, `border-gray-100`). They mostly resolve
   to the same values, but a documented mapping (or consolidating on one) would
   stop them drifting.
3. **Audit destructive styling.** Deny / delete actions use literal `red-600`;
   route them through the existing `--destructive` token for one source of truth.
4. **Spacing rhythm pass.** `STYLE_GUIDE.md` prescribes section padding (`py-12 lg:py-16`)
   and gap scales; a few pages use ad-hoc vertical spacing (`mt-16`, `py-8`). A
   light pass would even out the vertical rhythm between sections.
5. **Iconography weight + sizing consistency.** Lucide icons appear at `h-3` →
   `h-7` across contexts; codifying a small set of icon sizes per role (nav,
   inline, feature) would tighten the visual system.
