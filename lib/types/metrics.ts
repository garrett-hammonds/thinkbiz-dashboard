// Shared shapes for dashboard metrics, sourced from the `weekly_logs` and
// `closed_business_thanks` Supabase tables. Kept in one place so the
// dashboard page, scorecards, and charts agree on the fields they read.

export interface WeeklyLog {
  visitors_brought: number;
  one_on_ones_had: number;
  // Written by the log form, but not read by the dashboard, so the dashboard
  // queries don't select it. Optional here to match what's actually fetched.
  referrals_given?: number;
  // The week the activity happened (date the member selected). Preferred over
  // created_at for time-bucketing so a late submission lands in the right week.
  week_ending?: string | null;
  created_at: string;
}

export interface RevenueLog {
  revenue_amount: number;
  created_at: string;
}

// One bar in the monthly charts: a month label plus the aggregated metrics.
export interface MonthlyChartDatum {
  date: string;
  revenue: number;
  visitors: number;
  oneOnOnes: number;
  thanked: number;
}
