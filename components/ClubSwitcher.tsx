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
}: {
  clubs: SwitcherClub[];
  activeClubId: string | null;
  className?: string;
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
      className={`flex items-center gap-1.5 ${className}`}
      title="Switch the club you're managing"
    >
      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Managing club</span>
      <select
        value={activeClubId ?? ''}
        onChange={onChange}
        disabled={isPending}
        aria-label="Switch the club you're managing"
        className="max-w-[12rem] truncate rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
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
