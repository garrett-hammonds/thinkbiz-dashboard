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
export const METRIC_COLORS = {
  revenue: '#086788',
  visitors: '#21bdc8',
  oneOnOnes: '#13889a',
  thanked: '#f0c808',
} as const;
