'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { setActiveClub } from '@/app/actions/setActiveClub';

export type SwitcherClub = { id: string; label: string };

// Admin-only control (rendered in the navbar) for switching which club's
// director surfaces — roster, visitors, check-in QR, dashboard club stats, and
// application review — the admin is currently managing. "All clubs" clears the
// override and falls back to the admin's own club.
export function ClubSwitcher({
  clubs,
  activeClubId,
  className = '',
  large = false,
}: {
  clubs: SwitcherClub[];
  activeClubId: string | null;
  className?: string;
  // Thumb-sized styling for the full-screen mobile menu, matching SidebarNav's
  // `large` variant.
  large?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || null;
    startTransition(async () => {
      await setActiveClub(value);
      // The cookie is read by server components, so re-render the current route
      // to pull the newly selected club through.
      router.refresh();
    });
  };

  return (
    <label
      className={`flex items-center ${large ? 'gap-3' : 'gap-2'} ${className}`}
      title="Switch the club you're managing"
    >
      <Building2
        className={`${large ? 'h-6 w-6' : 'h-4 w-4'} shrink-0 text-primary`}
        aria-hidden="true"
      />
      <span className="sr-only">Managing club</span>
      {/* Primary-tinted border/text so the control reads as clickable next to
          the nav rows instead of blending into the card background. */}
      <select
        value={activeClubId ?? ''}
        onChange={onChange}
        disabled={isPending}
        aria-label="Switch the club you're managing"
        className={`w-full min-w-0 flex-1 truncate rounded-lg border-2 border-primary/40 bg-card font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${
          large ? 'px-4 py-3 text-lg' : 'px-2.5 py-2 text-sm'
        }`}
      >
        <option value="">All clubs</option>
        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.label}
          </option>
        ))}
      </select>
    </label>
  );
}
