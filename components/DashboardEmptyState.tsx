import Link from "next/link";
import { ClipboardList, TrendingUp, DollarSign, Users } from "lucide-react";

// First-run state for the dashboard. A member who has just finished onboarding
// has no weekly logs yet, so the scorecards and trend charts would otherwise
// render as four $0 cards and four empty bars — the product's core surface
// looking broken at the exact moment of first impression. Instead, show a
// guided, on-brand prompt that explains what the dashboard will become and
// points straight at the one action that fills it: logging the first week.
export default function DashboardEmptyState() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-8 shadow-card sm:p-12">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <TrendingUp className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-2xl font-bold leading-snug text-foreground">
          Your dashboard is ready for your first numbers
        </h2>
        <p className="mt-2 text-base leading-relaxed text-gray-500">
          Once you log a week of activity, this is where you&apos;ll track your
          revenue, visitors, one-on-ones and referrals over time — for yourself
          and your club.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <PreviewTile
            icon={<DollarSign className="h-4 w-4" />}
            label="Closed business"
          />
          <PreviewTile
            icon={<Users className="h-4 w-4" />}
            label="Visitors & 1-on-1s"
          />
          <PreviewTile
            icon={<TrendingUp className="h-4 w-4" />}
            label="Monthly trends"
          />
        </div>

        <Link
          href="/log"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-secondary focus-visible:outline-primary"
        >
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          Log my first week
        </Link>
      </div>
    </div>
  );
}

function PreviewTile({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-slate-50 px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-primary shadow-sm">
        {icon}
      </span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  );
}
