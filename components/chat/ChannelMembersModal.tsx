"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserMinus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { addChannelMembers, getChannelMembers, removeChannelMember } from "@/app/actions/chat";
import type { ChannelMemberOption, ChatChannel, ChatMember } from "./types";
import { memberName } from "./types";

type Props = {
  channel: ChatChannel;
  meId: string;
  onClose: () => void;
  // Newly added members, so the chat can render their names and headshots.
  onAdded: (members: ChatMember[]) => void;
};

// Members of an open channel, for its creator (or an admin): who's in it, with
// a Remove button, and a searchable list of everyone else to add.
export function ChannelMembersModal({ channel, meId, onClose, onAdded }: Props) {
  const [members, setMembers] = useState<ChannelMemberOption[] | null>(null);
  const [candidates, setCandidates] = useState<ChannelMemberOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getChannelMembers(channel.id)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setMembers(res.members);
          setCandidates(res.candidates);
        } else {
          setMembers([]);
          setError(res.message);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMembers([]);
        setError("Could not load members. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [channel.id]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((m) =>
      `${memberName(m)} ${m.club_label ?? ""}`.toLowerCase().includes(q)
    );
  }, [candidates, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await addChannelMembers(channel.id, [...selected]);
    setBusy(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    const addedIds = new Set(res.added.map((m) => m.id));
    const moved = candidates.filter((m) => addedIds.has(m.id));
    setCandidates((prev) => prev.filter((m) => !addedIds.has(m.id)));
    setMembers((prev) =>
      [...(prev ?? []), ...moved].sort((a, b) => memberName(a).localeCompare(memberName(b)))
    );
    setSelected(new Set());
    setQuery("");
    setNotice(`Added ${moved.length} ${moved.length === 1 ? "member" : "members"}.`);
    onAdded(res.added);
  };

  const handleRemove = async (m: ChannelMemberOption) => {
    if (busy || !window.confirm(`Remove ${memberName(m)} from #${channel.name}?`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await removeChannelMember(channel.id, m.id);
    setBusy(false);
    if (!res.success) {
      setError(res.message || "Could not remove that member.");
      return;
    }
    setMembers((prev) => (prev ?? []).filter((x) => x.id !== m.id));
    setCandidates((prev) =>
      [...prev, m].sort((a, b) => memberName(a).localeCompare(memberName(b)))
    );
  };

  return (
    <Modal title={`#${channel.name} members`} onClose={onClose}>
      {members === null ? (
        <p className="py-4 text-sm text-gray-500">Loading members…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <section>
            <h4 className="mb-1 text-sm font-semibold text-foreground">
              In this channel ({members.length})
            </h4>
            {members.length === 0 ? (
              <p className="py-2 text-sm text-gray-500">No members yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <MemberLabel member={m} />
                    {m.id === meId ? (
                      <span className="shrink-0 text-xs font-semibold text-gray-500">You</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemove(m)}
                        disabled={busy}
                        aria-label={`Remove ${memberName(m)}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <UserMinus className="h-4 w-4" aria-hidden="true" />
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-foreground">Add members</h4>
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or club"
                aria-label="Search members to add"
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            {matches.length === 0 ? (
              <p className="py-2 text-sm text-gray-500">
                {candidates.length === 0 ? "Everyone is already in this channel." : "No matches."}
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
                {matches.map((m) => (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggle(m.id)}
                        className="h-4 w-4 shrink-0 accent-primary"
                      />
                      <MemberLabel member={m} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-gray-700">{notice}</p>}

          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || selected.size === 0}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : selected.size === 0
                ? "Add members"
                : `Add ${selected.size} ${selected.size === 1 ? "member" : "members"}`}
          </button>
        </div>
      )}
    </Modal>
  );
}

function MemberLabel({ member }: { member: ChannelMemberOption }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium text-foreground">{memberName(member)}</span>
      {member.club_label && (
        <span className="block truncate text-xs text-gray-500">{member.club_label}</span>
      )}
    </span>
  );
}
