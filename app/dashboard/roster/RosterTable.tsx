'use client';

import { useMemo, useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  Shield,
  Building2,
  Send,
  Loader2,
} from 'lucide-react';
import { resendInvite } from '@/app/actions/resendInvite';

export interface RosterRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  headshot: string | null;
  isDirector: boolean;
  isAdmin: boolean;
  joined: boolean;
}

type StatusFilter = 'all' | 'joined' | 'not_joined';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const joinedCount = useMemo(() => rows.filter((r) => r.joined).length, [rows]);
  const notJoinedCount = rows.length - joinedCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === 'joined' && !r.joined) return false;
      if (status === 'not_joined' && r.joined) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.company || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, status]);

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All members', count: rows.length },
    { key: 'joined', label: 'Joined the app', count: joinedCount },
    { key: 'not_joined', label: 'Not joined yet', count: notJoinedCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Summary scorecards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Active members"
          value={rows.length}
          icon={<Building2 className="h-5 w-5 text-primary" />}
        />
        <SummaryCard
          label="Joined the app"
          value={joinedCount}
          icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
        />
        <SummaryCard
          label="Not joined yet"
          value={notJoinedCount}
          icon={<Clock className="h-5 w-5 text-accent" />}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatus(t.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                status === t.key
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  status === t.key ? 'bg-white/20 text-white' : 'bg-white text-gray-900'
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

      {/* Roster */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-muted-foreground shadow-card">
          No members match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          {/* Desktop table */}
          <table className="hidden w-full text-left md:table">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">App status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-gray-50 last:border-0 transition-colors hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} headshot={r.headshot} />
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          {r.name}
                          {(r.isAdmin || r.isDirector) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-bold text-secondary">
                              <Shield className="h-3 w-3" />
                              {r.isAdmin ? 'Admin' : 'Director'}
                            </span>
                          )}
                        </div>
                        {r.title && (
                          <div className="text-sm text-gray-500">{r.title}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <a
                        href={`mailto:${r.email}`}
                        className="text-primary transition-colors hover:text-secondary"
                      >
                        {r.email}
                      </a>
                    </div>
                    {r.phone && (
                      <div className="mt-1 flex items-center gap-2 text-gray-500">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {r.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {r.company || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-2">
                      <StatusBadge joined={r.joined} />
                      {!r.joined && <ResendInviteButton memberId={r.id} />}
                    </div>
                  </td>
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
                    <Avatar name={r.name} headshot={r.headshot} />
                    <div>
                      <div className="font-semibold text-foreground">{r.name}</div>
                      {r.title && (
                        <div className="text-sm text-gray-500">{r.title}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge joined={r.joined} />
                    {!r.joined && <ResendInviteButton memberId={r.id} />}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <a
                    href={`mailto:${r.email}`}
                    className="flex items-center gap-2 text-primary"
                  >
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {r.email}
                  </a>
                  {r.phone && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      {r.phone}
                    </div>
                  )}
                  {r.company && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      {r.company}
                    </div>
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

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function Avatar({ name, headshot }: { name: string; headshot: string | null }) {
  if (headshot) {
    return (
      <img
        src={headshot}
        alt={name}
        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {initials(name)}
    </div>
  );
}

type InviteState = 'idle' | 'sending' | 'sent' | 'error';

function ResendInviteButton({ memberId }: { memberId: string }) {
  const [state, setState] = useState<InviteState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      const result = await resendInvite(memberId);
      if (result.success) {
        setState('sent');
      } else {
        setState('error');
        setError(result.message || 'Could not send invite.');
      }
    } catch {
      setState('error');
      setError('Something went wrong. Try again.');
    }
  }

  if (state === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Invite sent
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'sending'}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'sending' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {state === 'sending' ? 'Sending…' : state === 'error' ? 'Retry invite' : 'Resend invite'}
      </button>
      {state === 'error' && error && (
        <span className="max-w-48 text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}

function StatusBadge({ joined }: { joined: boolean }) {
  if (joined) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Joined
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-0.5 text-sm font-medium text-gray-900">
      <Clock className="h-3.5 w-3.5" />
      Invited
    </span>
  );
}
