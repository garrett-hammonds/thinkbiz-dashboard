'use client';

import { useState, useTransition } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { startDirectMessage, toggleMemberStar } from '@/app/actions/directory';

type Props = {
  memberId: string;
  memberFirstName: string;
  initialStarred: boolean;
};

// The two member-to-member actions on a directory profile: star (bookmark for
// the directory's "Starred" filter) and DM (jump into a 1:1 chat).
export function ProfileActions({ memberId, memberFirstName, initialStarred }: Props) {
  const [starred, setStarred] = useState(initialStarred);
  const [openingDm, startDmTransition] = useTransition();

  const handleToggleStar = () => {
    const next = !starred;
    setStarred(next);
    void toggleMemberStar(memberId, next).then((result) => {
      if (!result.success) setStarred(!next);
    });
  };

  const handleDm = () => {
    // startDirectMessage redirects into /chat on success.
    startDmTransition(async () => {
      await startDirectMessage(memberId);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleDm}
        disabled={openingDm}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        {openingDm ? 'Opening chat…' : `Message ${memberFirstName}`}
      </button>

      <button
        type="button"
        onClick={handleToggleStar}
        aria-pressed={starred}
        className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors ${
          starred
            ? 'bg-accent text-gray-900 hover:bg-yellow-400'
            : 'border-2 border-primary text-primary hover:bg-primary hover:text-white'
        }`}
      >
        <Star className={`h-4 w-4 ${starred ? 'fill-current' : ''}`} aria-hidden="true" />
        {starred ? 'Starred' : 'Star'}
      </button>
    </div>
  );
}
