'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Search,
  Mail,
  Phone,
  Building2,
  Users,
  CalendarDays,
  Trash2,
  Loader2,
} from 'lucide-react';
import { deleteVisitorAction } from '@/app/actions/deleteVisitor';

export interface VisitorRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
  source: 'meeting' | 'preregistration';
  visitedOn: string; // YYYY-MM-DD
}

type SourceFilter = 'all' | 'meeting' | 'preregistration';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(iso: string): string {
  // iso is a plain YYYY-MM-DD; parse as local to avoid a timezone day shift.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function VisitorList({
  rows,
  canManage,
}: {
  rows: VisitorRow[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const visible = useMemo(() => rows.filter((r) => !removed.has(r.id)), [rows, removed]);

  const meetingCount = useMemo(
    () => visible.filter((r) => r.source === 'meeting').length,
    [visible],
  );
  const prereg = visible.length - meetingCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter((r) => {
      if (source !== 'all' && r.source !== source) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q)
      );
    });
  }, [visible, search, source]);

  const tabs: { key: SourceFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All visitors', count: visible.length },
    { key: 'meeting', label: 'Walk-ins', count: meetingCount },
    { key: 'preregistration', label: 'Pre-registered', count: prereg },
  ];

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-10 text-center shadow-card">
        <Users className="mx-auto mb-3 h-8 w-8 text-primary/60" />
        <p className="font-semibold text-foreground">No visitors yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {canManage
            ? 'Display the check-in QR code at your next meeting to start collecting visitor details.'
            : 'Visitors will appear here once they check in at a meeting or pre-register.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total visitors" value={visible.length} icon={<Users className="h-5 w-5 text-primary" />} />
        <SummaryCard label="Walk-ins" value={meetingCount} icon={<Building2 className="h-5 w-5 text-primary" />} />
        <SummaryCard label="Pre-registered" value={prereg} icon={<CalendarDays className="h-5 w-5 text-accent" />} />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSource(t.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                source === t.key
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  source === t.key ? 'bg-white/20 text-white' : 'bg-white text-gray-900'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-muted-foreground shadow-card">
          No visitors match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          {/* Desktop table */}
          <table className="hidden w-full text-left md:table">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Visitor</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3">Visited</th>
                {canManage && <th className="px-6 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 transition-colors hover:bg-slate-50 align-top">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} />
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          {r.name}
                          <SourceBadge source={r.source} />
                        </div>
                        {(r.title || r.company) && (
                          <div className="text-sm text-gray-500">
                            {[r.title, r.company].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Contact email={r.email} phone={r.phone} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                    {r.notes || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(r.visitedOn)}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <DeleteButton
                        id={r.id}
                        name={r.name}
                        onRemoved={(id) => setRemoved((s) => new Set(s).add(id))}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="divide-y divide-gray-50 md:hidden">
            {filtered.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} />
                    <div>
                      <div className="font-semibold text-foreground">{r.name}</div>
                      {(r.title || r.company) && (
                        <div className="text-sm text-gray-500">
                          {[r.title, r.company].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <SourceBadge source={r.source} />
                </div>
                <Contact email={r.email} phone={r.phone} />
                {r.notes && <p className="text-sm text-gray-700">{r.notes}</p>}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-gray-500">
                    <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                    {formatDate(r.visitedOn)}
                  </span>
                  {canManage && (
                    <DeleteButton
                      id={r.id}
                      name={r.name}
                      onRemoved={(id) => setRemoved((s) => new Set(s).add(id))}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Contact({ email, phone }: { email: string | null; phone: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      {email && (
        <a href={`mailto:${email}`} className="flex items-center gap-2 text-primary transition-colors hover:text-secondary">
          <Mail className="h-3.5 w-3.5 text-gray-400" />
          {email}
        </a>
      )}
      {phone && (
        <a href={`tel:${phone}`} className="flex items-center gap-2 text-primary transition-colors hover:text-secondary">
          <Phone className="h-3.5 w-3.5 text-gray-400" />
          {phone}
        </a>
      )}
      {!email && !phone && <span className="text-gray-400">—</span>}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {initials(name)}
    </div>
  );
}

function SourceBadge({ source }: { source: 'meeting' | 'preregistration' }) {
  if (source === 'preregistration') {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
        Pre-registered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      Walk-in
    </span>
  );
}

function DeleteButton({
  id,
  name,
  onRemoved,
}: {
  id: string;
  name: string;
  onRemoved: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleClick() {
    if (isPending) return;
    if (!window.confirm(`Remove ${name} from the visitor list? This can't be undone.`)) {
      return;
    }
    setError(false);
    startTransition(async () => {
      const result = await deleteVisitorAction(id);
      if (result.success) {
        onRemoved(id);
      } else {
        setError(true);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={error ? 'Could not remove — try again' : 'Remove visitor'}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
        error
          ? 'border-red-300 text-red-600 hover:bg-red-50'
          : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600'
      }`}
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {error ? 'Retry' : 'Remove'}
    </button>
  );
}
