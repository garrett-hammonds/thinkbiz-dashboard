'use client';

import { useState } from 'react';
import { Ban } from 'lucide-react';
import { setDmBlock } from '@/app/actions/chatSafety';

export type BlockedMember = { id: string; name: string };

// Members the viewer has blocked, with unblock. Blocking itself happens from a
// chat message, a DM's header, or a directory profile.
export default function BlockedMembersSection({ initial }: { initial: BlockedMember[] }) {
  const [blocked, setBlocked] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function unblock(id: string) {
    setBusyId(id);
    const result = await setDmBlock(id, false);
    setBusyId(null);
    if (result.success) setBlocked((prev) => prev.filter((m) => m.id !== id));
    else window.alert(result.message || 'Could not unblock. Please try again.');
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 mb-6">
      <h3 className="text-2xl font-bold leading-snug text-foreground mb-2">Blocked members</h3>
      <p className="text-sm text-gray-600 mb-6">
        You won&apos;t see messages from blocked members anywhere in chat, and neither of you can send
        direct messages to the other. ThinkBiz is notified when you block someone. To block someone,
        tap one of their messages in chat (or open your conversation with them or their directory
        profile) and choose Block. To report a message, tap it in chat and choose the flag.
        Unblocking brings their messages back.
      </p>
      {blocked.length === 0 ? (
        <p className="text-sm text-gray-500">You haven&apos;t blocked anyone.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {blocked.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Ban className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              <span className="flex-1 truncate text-sm font-semibold text-foreground">{m.name}</span>
              <button
                type="button"
                onClick={() => unblock(m.id)}
                disabled={busyId === m.id}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {busyId === m.id ? 'Unblocking…' : 'Unblock'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
