"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";
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
import { METRIC_COLORS, METRIC_STROKE_COLORS } from "@/lib/chartColors";

export interface AttendanceWeekDatum {
  // Short tick label, e.g. "Jul 1".
  date: string;
  present: number;
}

interface AttendanceSummaryProps {
  // Trailing weekly slots, oldest first, ending with the current week.
  data: AttendanceWeekDatum[];
  rosterSize: number;
  meetingDayLabel: string;
}

// Director/admin-only club attendance widgets on the dashboard: a scorecard
// for this week plus the week-over-week trend. Mirrors the look of
// Scorecards + DashboardCharts so the section reads as part of the same
// system, but on a weekly (meeting-slot) axis rather than monthly.
export function AttendanceSummary({
  data,
  rosterSize,
  meetingDayLabel,
}: AttendanceSummaryProps) {
  const color = METRIC_COLORS.attendance;
  const strokeColor = METRIC_STROKE_COLORS.attendance;

  const thisWeek = data[data.length - 1]?.present ?? 0;
  const rate = rosterSize > 0 ? Math.round((thisWeek / rosterSize) * 100) : 0;

  const values = data.map((d) => d.present);
  const average = values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : 0;
  const showAverage = average > 0;

  const summary = `Attendance: ${thisWeek} of ${rosterSize} members this week, across the last ${data.length} weekly meetings.`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-100 bg-card p-5 shadow-card">
        <div className="flex items-start gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}14`, color }}
          >
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-medium text-muted-foreground lg:text-sm">
              This week&apos;s attendance
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-card-foreground lg:text-2xl">
              {thisWeek} of {rosterSize}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground lg:text-xs">
              {rate}% of active members · meets {meetingDayLabel}s
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/attendance"
          className="text-base font-semibold text-primary transition-colors hover:text-secondary lg:text-sm"
        >
          Manage attendance →
        </Link>
      </div>

      <div className="rounded-xl border border-gray-100 bg-card p-5 shadow-card lg:col-span-2">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-card-foreground lg:text-sm">
            Attendance by Week
          </h3>
          <span className="text-sm font-medium text-muted-foreground lg:text-xs">
            last {data.length} meetings
          </span>
        </div>
        <div className="h-56" role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 20, left: 0, bottom: 5 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id="attendance-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: "0.75rem", fill: "var(--color-muted-foreground)" }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
                minTickGap={8}
              />
              <YAxis
                tick={{ fontSize: "0.75rem", fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={40}
                allowDecimals={false}
                // Pin the axis to roster size so a full house visually reads
                // as a full chart, not an arbitrary local maximum.
                domain={[0, Math.max(rosterSize, 1)]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                formatter={(value: number) => [
                  `${value.toLocaleString()} of ${rosterSize}`,
                  "Present",
                ]}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              {showAverage && (
                <ReferenceLine
                  y={average}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `avg ${Math.round(average)}`,
                    position: "insideTopRight",
                    fontSize: "0.65rem",
                    fill: "var(--color-muted-foreground)",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="present"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#attendance-fill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: strokeColor }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
