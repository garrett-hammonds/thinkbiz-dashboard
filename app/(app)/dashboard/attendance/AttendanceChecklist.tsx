'use client';

import { useState } from 'react';
import { Check, ScanLine } from 'lucide-react';
import { setAttendanceAction } from '@/app/actions/attendance';

export interface ChecklistRow {
  id: string;
  name: string;
  headshot: string | null;
  present: boolean;
  // 'scan' | 'manual' | null — shown so a director can tell door scans from
  // hand-entered marks at a glance.
  source: string | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Tap-to-toggle attendance list for one weekly meeting slot. Updates are
// optimistic — the row flips immediately and reverts (with a message) only if
// the server rejects the change.
export function AttendanceChecklist({
  rows,
  meetingDate,
}: {
  rows: ChecklistRow[];
  meetingDate: string;
}) {
  const [presentIds, setPresentIds] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.present).map((r) => r.id)),
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const presentCount = presentIds.size;

  async function toggle(row: ChecklistRow) {
    if (pendingIds.has(row.id)) return;
    const nextPresent = !presentIds.has(row.id);

    setError(null);
    setPendingIds((prev) => new Set(prev).add(row.id));
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (nextPresent) next.add(row.id);
      else next.delete(row.id);
      return next;
    });

    const res = await setAttendanceAction({
      memberId: row.id,
      meetingDate,
      present: nextPresent,
    });

    if (!res.success) {
      // Roll back the optimistic flip.
      setPresentIds((prev) => {
        const next = new Set(prev);
        if (nextPresent) next.delete(row.id);
        else next.add(row.id);
        return next;
      });
      setError(res.message ?? 'Could not update attendance.');
    }

    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(row.id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active members in this club yet.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-card-foreground">Members</h2>
        <p className="text-sm font-bold text-card-foreground">
          {presentCount} of {rows.length} present
        </p>
      </div>

      {error && (
        <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="divide-y divide-gray-100">
        {rows.map((row) => {
          const present = presentIds.has(row.id);
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => toggle(row)}
                aria-pressed={present}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
              >
                {row.headshot ? (
                  <img
                    src={row.headshot}
                    alt=""
                    className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {initials(row.name)}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {row.name}
                  </span>
                  {present && row.source === 'scan' && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ScanLine className="h-3 w-3" aria-hidden="true" />
                      Scanned in
                    </span>
                  )}
                </span>

                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    present
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
