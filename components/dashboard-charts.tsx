"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { WeeklyLog, RevenueLog, MonthlyChartDatum } from "@/lib/types/metrics";

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
// that silently merges data from different years into the same bar.
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

interface MetricChartProps {
  title: string;
  dataKey: string;
  color: string;
  chartData: MonthlyChartDatum[];
  formatAsCurrency?: boolean;
}

function MetricChart({ title, dataKey, color, chartData, formatAsCurrency }: MetricChartProps) {
  const formatValue = (value: number) =>
    formatAsCurrency ? `$${value.toLocaleString()}` : value.toString();

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-card-foreground">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAsCurrency ? (v) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(v) : undefined}
              width={formatAsCurrency ? 50 : 30}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "13px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value: number) => [formatValue(value), title]}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardCharts({ data, revenueData = [] }: DashboardChartsProps) {
  const now = new Date();
  const chartData = buildWindow(now);

  // Index the window by year-month so each datapoint lands in exactly one bar,
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
        color="#4CAF50"
        chartData={chartData}
        formatAsCurrency
      />
      <MetricChart
        title="Visitors by Month"
        dataKey="visitors"
        color="#2196F3"
        chartData={chartData}
      />
      <MetricChart
        title="1-on-1s by Month"
        dataKey="oneOnOnes"
        color="#9C27B0"
        chartData={chartData}
      />
      <MetricChart
        title="Members Thanked by Month"
        dataKey="thanked"
        color="#FF9800"
        chartData={chartData}
      />
    </div>
  );
}
