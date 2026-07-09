import { DollarSign, Users, Handshake, Heart } from "lucide-react";
import type { WeeklyLog, RevenueLog } from "@/lib/types/metrics";
import { METRIC_COLORS } from "@/lib/chartColors";

interface ScorecardsProps {
  logsData: WeeklyLog[];
  revenueData: RevenueLog[];
}

interface ScorecardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
}

function Scorecard({ title, value, subtitle, icon, accentColor }: ScorecardProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-[2px]">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-base font-medium text-muted-foreground lg:text-sm">
          {title}
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-card-foreground lg:text-2xl">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground lg:text-xs">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export function Scorecards({ logsData, revenueData }: ScorecardsProps) {
  const totalRevenue = revenueData.reduce((acc, log) => acc + (Number(log.revenue_amount) || 0), 0);
  const totalVisitors = logsData.reduce((acc, log) => acc + (log.visitors_brought || 0), 0);
  const totalOneOnOnes = logsData.reduce((acc, log) => acc + (log.one_on_ones_had || 0), 0);
  const membersThankedCount = revenueData.length;

  const formattedRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalRevenue);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      <Scorecard
        title="Total Revenue"
        value={formattedRevenue}
        icon={<DollarSign className="h-5 w-5" />}
        accentColor={METRIC_COLORS.revenue}
      />
      <Scorecard
        title="Visitors Brought"
        value={totalVisitors.toString()}
        icon={<Users className="h-5 w-5" />}
        accentColor={METRIC_COLORS.visitors}
      />
      <Scorecard
        title="Total 1-on-1s"
        value={totalOneOnOnes.toString()}
        icon={<Handshake className="h-5 w-5" />}
        accentColor={METRIC_COLORS.oneOnOnes}
      />
      <Scorecard
        title="Members Thanked"
        value={membersThankedCount.toString()}
        subtitle="for closed business"
        icon={<Heart className="h-5 w-5" />}
        accentColor={METRIC_COLORS.thanked}
      />
    </div>
  );
}
