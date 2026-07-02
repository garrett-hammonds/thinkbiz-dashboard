// Brand-derived palette for the dashboard metrics, shared by the scorecards and
// the trend charts so the two surfaces always agree on a metric's color.
//
// The style guide forbids ad-hoc hex codes and calls for the semantic brand
// colors. These four values are points on the ThinkBiz teal→navy ramp plus the
// gold accent — replacing the previous Material Design palette
// (#4CAF50 / #2196F3 / #9C27B0 / #FF9800), which was off-brand and shared
// nothing with the rest of the product.
//
//   revenue   → navy  (#086788) — the headline metric gets the deepest, most
//                                 premium tone
//   visitors  → teal  (#21bdc8) — brand primary
//   oneOnOnes → mid-teal (#13889a) — a deliberate midpoint on the brand ramp
//   thanked   → gold  (#f0c808) — brand accent, a warm pop for gratitude
//   attendance → deep teal (#0d7791) — another point on the same teal→navy
//                                 ramp (between navy and mid-teal), used by
//                                 the director-only club attendance widgets
export const METRIC_COLORS = {
  revenue: '#086788',
  visitors: '#21bdc8',
  oneOnOnes: '#13889a',
  thanked: '#f0c808',
  attendance: '#0d7791',
} as const;

// Stroke colors for the chart line/area marks. A scorecard icon is a chunky
// glyph on a tinted chip, but a chart line is a thin 2px mark on a white card —
// to read as a data mark it must clear ~3:1 non-text contrast (WCAG 1.4.11)
// against that white. Two of the identity colors fail as thin marks: the brand
// gold (#f0c808) is only ~1.6:1 and the bright teal (#21bdc8) ~2.3:1. Their
// strokes use a deeper, same-hue shade (gold ~3.8:1, teal ~3.6:1) while the
// translucent area FILL keeps the identity color — so each chart still reads as
// its brand color, but the line that actually defines the trend is legible.
// Navy and mid-teal already clear 3:1, so they stroke with their identity color.
export const METRIC_STROKE_COLORS = {
  revenue: METRIC_COLORS.revenue,
  visitors: '#0d96a3',
  oneOnOnes: METRIC_COLORS.oneOnOnes,
  thanked: '#a07f00',
  // Deep teal already clears 3:1 against white as a thin mark.
  attendance: METRIC_COLORS.attendance,
} as const;
