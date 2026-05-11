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

interface WeeklyLog {
  revenue: number;
  visitors_brought: number;
  one_on_ones_had: number;
  referrals_given: number;
  created_at: string;
}

interface DashboardChartsProps {
  data: WeeklyLog[];
  revenueData?: any[];
}

const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MetricChartProps {
  title: string;
  dataKey: string;
  color: string;
  chartData: any[];
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
  const monthlyTotals: Record<string, { date: string; revenue: number; visitors: number; oneOnOnes: number; thanked: number; }> = {};
  
  monthOrder.forEach((month) => {
    monthlyTotals[month] = { date: month, revenue: 0, visitors: 0, oneOnOnes: 0, thanked: 0 };
  });

  data.forEach((log) => {
    const month = new Date(log.created_at).toLocaleString('en-US', { month: 'short' });
    if (monthlyTotals[month]) {
      monthlyTotals[month].visitors += log.visitors_brought || 0;
      monthlyTotals[month].oneOnOnes += log.one_on_ones_had || 0;
    }
  });

  revenueData.forEach((rev) => {
    const month = new Date(rev.created_at).toLocaleString('en-US', { month: 'short' });
    if (monthlyTotals[month]) {
      monthlyTotals[month].revenue += rev.revenue_amount || 0;
      monthlyTotals[month].thanked += 1;
    }
  });

  const chartData = monthOrder.map(month => monthlyTotals[month]);

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
