"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { WeeklyLog, RevenueLog, MonthlyChartDatum } from "@/lib/types/metrics";
import { METRIC_COLORS, METRIC_STROKE_COLORS } from "@/lib/chartColors";
import { useBelowLg } from "@/lib/useBelowLg";

interface DashboardChartsProps {
  data: WeeklyLog[];
  revenueData?: RevenueLog[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WINDOW_MONTHS = 12;

// Stable key for a calendar month, e.g. "2026-5" for June 2026.
function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

// Builds an ordered list of the trailing `WINDOW_MONTHS` calendar months ending
// with the current month. Pre-seeding these guarantees the chart shows a fixed,
// chronological window (e.g. Jul '25 → Jun '26) rather than a bare Jan–Dec axis
// that silently merges data from different years into the same point.
function buildWindow(now: Date): MonthlyChartDatum[] {
  const months: MonthlyChartDatum[] = [];
  for (let i = WINDOW_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label =
      d.getMonth() === 0
        ? `${MONTH_LABELS[0]} '${String(d.getFullYear()).slice(-2)}`
        : MONTH_LABELS[d.getMonth()];
    months.push({ date: label, revenue: 0, visitors: 0, oneOnOnes: 0, thanked: 0 });
  }
  return months;
}

const currencyCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});
const currencyFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface MetricChartProps {
  title: string;
  dataKey: keyof MonthlyChartDatum;
  // The metric's identity color, used for the translucent area fill so the
  // chart still reads as its brand color on the scorecards and below the line.
  color: string;
  // A contrast-safe shade for the thin line/dot marks (see METRIC_STROKE_COLORS).
  strokeColor: string;
  chartData: MonthlyChartDatum[];
  formatAsCurrency?: boolean;
}

function MetricChart({ title, dataKey, color, strokeColor, chartData, formatAsCurrency }: MetricChartProps) {
  // Wider axis gutters below lg so the scaled-up mobile tick labels
  // (see globals.css) aren't clipped; desktop keeps its original geometry.
  const belowLg = useBelowLg();
  // Counts get thousands separators too (1,234 — not 1234) so a busy month
  // reads cleanly; currency uses a compact axis ($1.2K) but full value in tip.
  const formatValue = (value: number) =>
    formatAsCurrency ? currencyFull.format(value) : value.toLocaleString();
  const formatAxis = (value: number) =>
    formatAsCurrency ? currencyCompact.format(value) : value.toLocaleString();

  // The trailing-12-month average is the baseline a single month is judged
  // against ("is this month above or below my norm?"). Including zero-activity
  // months is deliberate: they are real months, so the average reflects the
  // true monthly pace rather than only the months that happened to have data.
  const values = chartData.map((d) => Number(d[dataKey]) || 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  const average = total / values.length;
  const latest = values[values.length - 1] ?? 0;

  // A flat all-zero series (e.g. a brand-new club view) has no meaningful
  // baseline to draw, so suppress the reference line there.
  const showAverage = average > 0;

  // Text alternative for screen readers and a scannable headline for everyone:
  // total across the window plus the most recent month.
  const summary = `${title}: ${formatValue(total)} total over the last 12 months, ${formatValue(
    latest
  )} this month.`;
  const gradientId = `metric-fill-${String(dataKey)}`;

  return (
    <div className="rounded-xl border border-gray-100 bg-card p-5 shadow-card">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-card-foreground lg:text-sm">
          {title}
        </h3>
        <span className="text-sm font-medium text-muted-foreground lg:text-xs">
          {formatValue(total)} total
        </span>
      </div>
      <div className="h-72 lg:h-56" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 20, left: 0, bottom: 5 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--color-muted-foreground)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
              minTickGap={8}
            />
            <YAxis
              tick={{ fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAxis}
              width={formatAsCurrency ? (belowLg ? 84 : 52) : (belowLg ? 56 : 40)}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "0.9rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value: number) => [formatValue(value), title]}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            {showAverage && (
              <ReferenceLine
                y={average}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: `avg ${formatValue(Math.round(average))}`,
                  position: "insideTopRight",
                  fill: "var(--color-muted-foreground)",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: strokeColor }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardCharts({ data, revenueData = [] }: DashboardChartsProps) {
  const now = new Date();
  const chartData = buildWindow(now);

  // Index the window by year-month so each datapoint lands in exactly one point,
  // keyed by both year and month — no cross-year collapsing.
  const byKey: Record<string, MonthlyChartDatum> = {};
  for (let i = WINDOW_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    byKey[monthKey(d.getFullYear(), d.getMonth())] = chartData[WINDOW_MONTHS - 1 - i];
  }

  data.forEach((log) => {
    // Prefer the activity week over the submission timestamp so a log entered
    // late is still attributed to the week it actually covers.
    const d = new Date(log.week_ending || log.created_at);
    const bucket = byKey[monthKey(d.getFullYear(), d.getMonth())];
    if (bucket) {
      bucket.visitors += log.visitors_brought || 0;
      bucket.oneOnOnes += log.one_on_ones_had || 0;
    }
  });

  revenueData.forEach((rev) => {
    const d = new Date(rev.created_at);
    const bucket = byKey[monthKey(d.getFullYear(), d.getMonth())];
    if (bucket) {
      bucket.revenue += rev.revenue_amount || 0;
      bucket.thanked += 1;
    }
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MetricChart
        title="Revenue by Month"
        dataKey="revenue"
        color={METRIC_COLORS.revenue}
        strokeColor={METRIC_STROKE_COLORS.revenue}
        chartData={chartData}
        formatAsCurrency
      />
      <MetricChart
        title="Visitors by Month"
        dataKey="visitors"
        color={METRIC_COLORS.visitors}
        strokeColor={METRIC_STROKE_COLORS.visitors}
        chartData={chartData}
      />
      <MetricChart
        title="1-on-1s by Month"
        dataKey="oneOnOnes"
        color={METRIC_COLORS.oneOnOnes}
        strokeColor={METRIC_STROKE_COLORS.oneOnOnes}
        chartData={chartData}
      />
      <MetricChart
        title="Members Thanked by Month"
        dataKey="thanked"
        color={METRIC_COLORS.thanked}
        strokeColor={METRIC_STROKE_COLORS.thanked}
        chartData={chartData}
      />
    </div>
  );
}
