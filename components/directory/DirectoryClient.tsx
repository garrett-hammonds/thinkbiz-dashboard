'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Star } from 'lucide-react';
import { toggleMemberStar } from '@/app/actions/directory';
import type { DirectoryClub, DirectoryListMember } from '@/utils/supabase/directory';

type Props = {
  members: DirectoryListMember[];
  clubs: DirectoryClub[];
  viewerId: string;
  viewerClubId: string | null;
  initialStarredIds: string[];
};

function clubLabel(club: DirectoryClub | undefined): string {
  if (!club) return '';
  return club.display_name || club.name || '';
}

function initialsOf(m: DirectoryListMember): string {
  return `${m.first_name?.[0] ?? ''}${m.last_name?.[0] ?? ''}`.toUpperCase() || '?';
}

export function DirectoryClient({
  members,
  clubs,
  viewerId,
  viewerClubId,
  initialStarredIds,
}: Props) {
  const [query, setQuery] = useState('');
  // Default view: the viewer's own club (falls back to everyone for members
  // not yet assigned to a club).
  const [clubFilter, setClubFilter] = useState<string>(viewerClubId ?? 'all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [starredOnly, setStarredOnly] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(
    () => new Set(initialStarredIds),
  );

  const clubById = useMemo(
    () => new Map(clubs.map((c) => [c.id, c])),
    [clubs],
  );

  const areas = useMemo(
    () =>
      [...new Set(clubs.map((c) => (c.area || '').trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [clubs],
  );

  const jobTypes = useMemo(
    () =>
      [
        ...new Set(
          members.map((m) => (m.club_seat || '').trim()).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [members],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (q) {
        const name = `${m.first_name} ${m.last_name}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      if (clubFilter !== 'all' && m.current_club_id !== clubFilter) return false;
      if (areaFilter !== 'all') {
        const club = m.current_club_id ? clubById.get(m.current_club_id) : undefined;
        if ((club?.area || '').trim() !== areaFilter) return false;
      }
      if (jobFilter !== 'all' && (m.club_seat || '').trim() !== jobFilter) return false;
      if (starredOnly && !starred.has(m.id)) return false;
      return true;
    });
  }, [members, query, clubFilter, areaFilter, jobFilter, starredOnly, starred, clubById]);

  const handleToggleStar = (memberId: string) => {
    const isStarred = starred.has(memberId);
    setStarred((prev) => {
      const next = new Set(prev);
      if (isStarred) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
    // Fire-and-forget with rollback: the star should feel instant.
    void toggleMemberStar(memberId, !isStarred).then((result) => {
      if (!result.success) {
        setStarred((prev) => {
          const next = new Set(prev);
          if (isStarred) next.add(memberId);
          else next.delete(memberId);
          return next;
        });
      }
    });
  };

  const selectClasses =
    'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none';

  return (
    <div>
      {/* Search + filters */}
      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-card">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members by name…"
            aria-label="Search members by name"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-500">
            Club
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className={selectClasses}
            >
              <option value="all">All clubs</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {clubLabel(c)}
                  {c.id === viewerClubId ? ' (my club)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-500">
            Area
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className={selectClasses}
            >
              <option value="all">All areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-500">
            Job type
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className={selectClasses}
            >
              <option value="all">All job types</option>
              {jobTypes.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setStarredOnly((s) => !s)}
            aria-pressed={starredOnly}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              starredOnly
                ? 'bg-accent text-gray-900'
                : 'border border-gray-300 text-gray-700 hover:bg-muted'
            }`}
          >
            <Star
              className={`h-4 w-4 ${starredOnly ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            Starred
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Showing {filtered.length} of {members.length} members
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-card">
          No members match these filters. Try clearing the search or switching
          to all clubs.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const club = m.current_club_id ? clubById.get(m.current_club_id) : undefined;
            const isSelf = m.id === viewerId;
            const isStarred = starred.has(m.id);
            const titleLine = [m.title, m.company_name].filter(Boolean).join(' · ');
            return (
              <li
                key={m.id}
                className="relative rounded-xl border border-gray-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-[2px] hover:shadow-card-hover"
              >
                <Link href={`/directory/${m.id}`} className="flex items-start gap-4 p-5">
                  {m.member_headshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.member_headshot}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {initialsOf(m)}
                    </span>
                  )}
                  <span className="min-w-0 pr-8">
                    <span className="block truncate font-bold text-foreground">
                      {m.first_name} {m.last_name}
                      {isSelf ? <span className="font-normal text-gray-500"> (you)</span> : null}
                    </span>
                    {titleLine && (
                      <span className="mt-0.5 block truncate text-sm text-gray-500">
                        {titleLine}
                      </span>
                    )}
                    {m.club_seat && (
                      <span className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
                        {m.club_seat}
                      </span>
                    )}
                    {club && (
                      <span className="mt-1.5 block truncate text-xs text-gray-500">
                        {clubLabel(club)}
                        {club.area ? ` · ${club.area}` : ''}
                      </span>
                    )}
                  </span>
                </Link>

                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => handleToggleStar(m.id)}
                    title={isStarred ? 'Remove star' : 'Star this member'}
                    aria-pressed={isStarred}
                    className={`absolute right-3 top-3 rounded-full p-1.5 transition-colors ${
                      isStarred
                        ? 'text-accent hover:bg-accent/10'
                        : 'text-gray-300 hover:bg-muted hover:text-gray-500'
                    }`}
                  >
                    <Star
                      className={`h-5 w-5 ${isStarred ? 'fill-current' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {isStarred ? 'Remove star' : 'Star this member'}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
