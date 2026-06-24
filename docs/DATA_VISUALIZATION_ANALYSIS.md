# ThinkBiz Dashboard — Data Visualization Analysis & Improvements

_Date: 2026-06-24_

A Data Visualization Designer review of the app's charts: whether the encodings
fit the data, whether a member can read meaning (not just numbers) off the
dashboard, and whether the charts are perceivable by everyone. Where the Visual
Design pass fixed the *colors* of the charts, this pass looks at the *charts
themselves* — the marks, axes, baselines, and the story they tell. Records the
findings, what shipped, and a backlog.

## 1. How the analysis was framed

The dashboard's analytical surface is one section — "**Monthly trends · last 12
months**" — rendering four small-multiple charts (Revenue, Visitors, 1-on-1s,
Members Thanked), each a single metric over a fixed trailing-12-month window,
plus four scorecards of all-time totals above them. The review judged that
surface against standard data-viz principles: does the **chart type match the
data type**? Is there a **baseline for comparison** so a value means something?
Are **numbers formatted** for reading? Are the marks **perceivable** and the
charts **accessible**? Four issues stood out.

## 2. Findings (prioritized)

### P0 — Bar charts were the wrong encoding for a time series (shipped)

The section is explicitly labelled "**Monthly trends**," but each metric was
drawn as a **bar chart**. Bars are a categorical encoding — they invite
comparison of discrete, unordered items and weight each month as a separate
object. A trend over ordered, continuous time is the textbook case for a
**line/area** encoding: it draws the eye along the trajectory (rising? flat?
falling?) instead of asking the viewer to mentally connect 12 bar-tops.

Two concrete readability costs of the bar version:

- **A zero month rendered as nothing.** A month with no activity is a
  zero-height bar — visually identical to "no data drawn at all." For a member
  with sparse activity (most months zero, one spike), the chart was 11 blanks
  and one bar, and you couldn't tell "logged a zero week" from "the chart is
  broken." On a line, a zero is a visible point sitting on the baseline.
- **Trajectory was hard to read.** The whole promise of the section — *trend* —
  is exactly what bars communicate worst.

**Shipped:** all four charts are now **gradient area charts** (`AreaChart` +
`Area`), each filled with its own brand metric color fading to transparent, with
a 2px stroke and a monotone curve (monotone specifically because it never
overshoots below the data range — counts and revenue stay visually ≥ 0). The
trajectory now reads at a glance, and zero months sit visibly on the axis.

### P1 — No baseline, so a single month meant nothing on its own (shipped)

A bar (or point) of "7 visitors" answers *how many* but not *is that good for
me?* Without a reference, every month is read in isolation. The single cheapest
way to add meaning to a time series is a **comparison baseline**.

**Shipped:** each chart now draws a dashed **trailing-12-month average**
reference line, labelled `avg N`. A member instantly sees which months beat
their own norm and which fell short — the chart now supports a judgment, not
just a lookup. The average deliberately includes zero-activity months (they are
real months, so the line reflects true monthly pace), and is suppressed when the
whole series is zero (e.g. a brand-new club view) so there is no meaningless
line at the axis.

### P2 — Numbers weren't formatted for reading; count axis could clip (shipped)

- **Counts had no thousands separators.** Revenue used a compact currency
  formatter, but the count metrics (visitors, 1-on-1s, thanked) printed raw:
  a busy club month read `1234` instead of `1,234` in both the axis and the
  tooltip.
- **The count Y-axis was 30px wide** — enough for two digits. A club rolling up
  every member's logs across a year can easily reach 3–4 digits, where the
  labels would crowd or clip.

**Shipped:** counts now run through `toLocaleString()` in the tooltip and on the
axis (`1,234`), and the count Y-axis width was widened (30 → 40px) to fit
realistic club-scale totals. Each chart card also gained a small **"N total"**
caption by the title, so the headline number is readable without hovering.

### P3 — Charts were invisible to screen readers (shipped)

The charts were pure SVG with no text alternative and no keyboard affordance —
a member using assistive tech got nothing from the core analytical surface.

**Shipped:** each chart's container is now `role="img"` with an `aria-label`
summarizing the series ("Revenue by Month: $12,500 total over the last 12
months, $2,000 this month."), and Recharts' `accessibilityLayer` is enabled so
the charts are keyboard-navigable with the arrow keys. Animation was disabled
(`isAnimationActive={false}`) to avoid the load-time motion and to keep the
first paint stable.

### P4 — Two metric marks failed graphical-object contrast (shipped)

Measuring the chart line/dot marks against the white card surface (WCAG 1.4.11
asks for ≥3:1 for graphical objects) surfaced two failures: the brand **gold**
(`thanked → #f0c808`) was only **1.62:1** and the bright **teal** (`visitors →
#21bdc8`) **2.29:1**. A scorecard icon is a chunky glyph on a tinted chip and
reads fine, but as a thin 2px line on white the gold in particular was barely
perceivable — the very mark that defines the trend.

**Shipped:** a dedicated `METRIC_STROKE_COLORS` map in `lib/chartColors.ts`. The
translucent area **fill keeps the identity color** (so each chart still reads as
its brand color, and the scorecards are untouched), while the thin line and
active dot use a **deeper, same-hue** shade where needed — gold `#f0c808` →
`#a07f00` (~3.8:1), teal `#21bdc8` → `#0d96a3` (~3.6:1). Navy (6.35:1) and
mid-teal (4.19:1) already clear 3:1, so they stroke with their identity color
unchanged. The metric's identity stays single-sourced; the stroke is an additive,
contrast-only concern.

## 3. What shipped in this pass

| Change | Files |
|---|---|
| Bar charts → brand-colored gradient **area charts** for the monthly trends | `components/dashboard-charts.tsx` |
| Dashed **12-month average** reference line (suppressed on all-zero series) | `components/dashboard-charts.tsx` |
| Count **thousands separators** (axis + tooltip), wider count Y-axis, per-card "N total" caption | `components/dashboard-charts.tsx` |
| Chart **accessibility**: `role="img"` + summarizing `aria-label`, `accessibilityLayer`, animation off | `components/dashboard-charts.tsx` |
| Contrast-safe **stroke palette** (`METRIC_STROKE_COLORS`) for the gold/teal line marks; identity fills unchanged | `lib/chartColors.ts`, `components/dashboard-charts.tsx` |

All changes are confined to the chart component and chart palette — no schema,
query, or component-contract changes. The shared `METRIC_COLORS` from the Visual
Design pass is reused **unchanged** as each metric's identity (scorecards + area
fills); the new stroke palette only deepens the thin line marks that failed
contrast, so a metric's color still agrees across scorecards and charts. `npm run
lint` is clean (0 errors; the 3 pre-existing `<img>` warnings are untouched) and
`npm run build` succeeds.

## 4. Backlog (recommended next, by priority)

1. **Time granularity control.** The window is hard-coded to 12 months. A
   simple range toggle (3 / 6 / 12 months, or "all time") would let members zoom
   the trend; pairs naturally with the `dashboard_metrics()` RPC the Data
   Engineering pass proposed (return the series already bucketed).
2. **Month-over-month delta on the scorecards.** The all-time totals don't show
   direction. A small "▲ +12% vs last month" under each scorecard would connect
   the totals to the trend charts and give the top of the dashboard a verdict.
3. **Show the "this month is partial" caveat.** The trailing window's last point
   is the current, incomplete month, so it almost always dips below the average —
   which reads as a decline. Marking the final point as in-progress (lighter
   fill / "MTD" annotation) would stop that false-negative read.
4. **Empty-vs-missing in club view.** A club with no logs yet renders four flat
   lines on the axis. A small "No club activity logged yet" overlay (mirroring
   the personal empty state) would be clearer than four empty axes.
