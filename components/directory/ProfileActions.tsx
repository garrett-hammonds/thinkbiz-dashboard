'use client';

import { useState, useTransition } from 'react';
import { Ban, MessageSquare, ShieldOff, Star } from 'lucide-react';
import { startDirectMessage, toggleMemberStar } from '@/app/actions/directory';
import { setChatSuspension, setDmBlock } from '@/app/actions/chatSafety';

type Props = {
  memberId: string;
  memberFirstName: string;
  initialStarred: boolean;
  // The viewer has blocked this member from DMing them.
  initialBlocked: boolean;
  // This member has blocked the viewer from DMing them.
  blockedMe: boolean;
  // Director (own club) / admin moderation: suspend from posting in chat.
  canSuspend: boolean;
  initialSuspended: boolean;
};

// Member-to-member actions on a directory profile: DM (jump into a 1:1 chat),
// star (bookmark for the directory's "Starred" filter), and block from
// direct messages. Directors and admins also get a chat suspension toggle
// for members they moderate.
export function ProfileActions({
  memberId,
  memberFirstName,
  initialStarred,
  initialBlocked,
  blockedMe,
  canSuspend,
  initialSuspended,
}: Props) {
  const [starred, setStarred] = useState(initialStarred);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [suspended, setSuspended] = useState(initialSuspended);
  const [openingDm, startDmTransition] = useTransition();
  const [busy, setBusy] = useState(false);

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

  const handleToggleBlock = async () => {
    const next = !blocked;
    if (
      next &&
      !window.confirm(
        `Block ${memberFirstName} from messaging you? Neither of you will be able to send direct messages to the other until you unblock them.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await setDmBlock(memberId, next);
    setBusy(false);
    if (result.success) setBlocked(next);
    else window.alert(result.message || 'Could not update the block. Please try again.');
  };

  const handleToggleSuspension = async () => {
    const next = !suspended;
    if (
      next &&
      !window.confirm(
        `Suspend ${memberFirstName} from chat? They will still be able to read chat but won't be able to post, react, or send direct messages until you lift the suspension.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await setChatSuspension(memberId, next);
    setBusy(false);
    if (result.success) setSuspended(next);
    else window.alert(result.message || 'Could not update the suspension. Please try again.');
  };

  const canMessage = !blocked && !blockedMe;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {canMessage && (
          <button
            type="button"
            onClick={handleDm}
            disabled={openingDm}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {openingDm ? 'Opening chat…' : `Message ${memberFirstName}`}
          </button>
        )}

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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={handleToggleBlock}
          disabled={busy}
          className="inline-flex items-center gap-1.5 font-semibold text-gray-500 transition-colors hover:text-red-600 disabled:opacity-50"
        >
          <Ban className="h-4 w-4" aria-hidden="true" />
          {blocked ? `Unblock ${memberFirstName}` : `Block ${memberFirstName} from messaging me`}
        </button>

        {canSuspend && (
          <button
            type="button"
            onClick={handleToggleSuspension}
            disabled={busy}
            className="inline-flex items-center gap-1.5 font-semibold text-gray-500 transition-colors hover:text-red-600 disabled:opacity-50"
          >
            <ShieldOff className="h-4 w-4" aria-hidden="true" />
            {suspended ? 'Lift chat suspension' : 'Suspend from chat'}
          </button>
        )}
      </div>

      {blocked && (
        <p className="text-sm text-gray-500">
          You blocked {memberFirstName}. Neither of you can send direct messages to the other.
        </p>
      )}
      {!blocked && blockedMe && (
        <p className="text-sm text-gray-500">You can&apos;t send {memberFirstName} direct messages.</p>
      )}
      {canSuspend && suspended && (
        <p className="text-sm text-gray-500">{memberFirstName} is suspended from posting in chat.</p>
      )}
    </div>
  );
}
