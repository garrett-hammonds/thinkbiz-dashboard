'use client';

import { type ReactNode, useState, useTransition } from 'react';
import Link from 'next/link';
import { Ban, Mail, MessageSquare, Pencil, Phone, ShieldOff, Star } from 'lucide-react';
import { startDirectMessage, toggleMemberStar } from '@/app/actions/directory';
import { setChatSuspension, setDmBlock } from '@/app/actions/chatSafety';

type Props = {
  memberId: string;
  memberFirstName: string;
  email: string | null;
  phone: string | null;
  // Viewing your own profile: swap the member actions for an Edit shortcut.
  isSelf: boolean;
  initialStarred: boolean;
  // The viewer has blocked this member (hidden in chat, no DMs either way).
  initialBlocked: boolean;
  // This member has blocked the viewer from DMing them.
  blockedMe: boolean;
  // Director (own club) / admin moderation: suspend from posting in chat.
  canSuspend: boolean;
  initialSuspended: boolean;
  // Avatar, name and title, shown above the quick actions.
  header: ReactNode;
  // Profile details rendered between the quick actions and the block/suspend
  // rows (server-rendered, passed through).
  children: ReactNode;
};

// The interactive frame of a directory profile, laid out like a messaging
// app's contact page: round quick actions (message, call, email, star) under
// the header, the profile details, then block and chat-suspension rows at the
// bottom. Block hides their chat messages from the viewer and stops DMs both
// ways; directors and admins also get a suspension toggle for members they
// moderate.
export function ProfileActions({
  memberId,
  memberFirstName,
  email,
  phone,
  isSelf,
  initialStarred,
  initialBlocked,
  blockedMe,
  canSuspend,
  initialSuspended,
  header,
  children,
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
        `Block ${memberFirstName}? Their messages will be hidden from you everywhere in chat, neither of you will be able to send direct messages to the other, and ThinkBiz will be notified. You can unblock them anytime from your Profile.`,
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
    <>
      <section className="rounded-xl border border-gray-100 bg-white px-5 py-8 shadow-card">
        {header}
        <div className="mt-6 flex flex-wrap justify-center gap-5 sm:gap-8">
          {isSelf ? (
            <QuickAction href="/profile" icon={<Pencil className="h-5 w-5" />} label="Edit profile" />
          ) : (
            <>
              {canMessage && (
                <QuickAction
                  onClick={handleDm}
                  disabled={openingDm}
                  icon={<MessageSquare className="h-5 w-5" />}
                  label={openingDm ? 'Opening…' : 'Message'}
                  ariaLabel={`Send ${memberFirstName} a direct message`}
                  primary
                />
              )}
              {phone && (
                <QuickAction
                  href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                  icon={<Phone className="h-5 w-5" />}
                  label="Call"
                />
              )}
              {email && (
                <QuickAction href={`mailto:${email}`} icon={<Mail className="h-5 w-5" />} label="Email" />
              )}
              <QuickAction
                onClick={handleToggleStar}
                pressed={starred}
                icon={<Star className={`h-5 w-5 ${starred ? 'fill-current' : ''}`} />}
                label={starred ? 'Starred' : 'Star'}
              />
            </>
          )}
        </div>

        {!isSelf && (blocked || blockedMe || (canSuspend && suspended)) && (
          <div className="mt-4 space-y-1 text-center text-sm text-gray-500">
            {blocked && (
              <p>
                You blocked {memberFirstName}. Their messages are hidden from you in chat, and neither
                of you can send direct messages to the other.
              </p>
            )}
            {!blocked && blockedMe && <p>You can&apos;t send {memberFirstName} direct messages.</p>}
            {canSuspend && suspended && <p>{memberFirstName} is suspended from posting in chat.</p>}
          </div>
        )}
      </section>

      {children}

      {!isSelf && (
        <section className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
          <button
            type="button"
            onClick={handleToggleBlock}
            disabled={busy}
            className="flex w-full items-center gap-5 px-5 py-4 text-left font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Ban className="h-5 w-5 shrink-0" aria-hidden="true" />
            {blocked ? `Unblock ${memberFirstName}` : `Block ${memberFirstName}`}
          </button>
          {canSuspend && (
            <button
              type="button"
              onClick={handleToggleSuspension}
              disabled={busy}
              className="flex w-full items-center gap-5 border-t border-gray-100 px-5 py-4 text-left font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <ShieldOff className="h-5 w-5 shrink-0" aria-hidden="true" />
              {suspended ? 'Lift chat suspension' : 'Suspend from chat'}
            </button>
          )}
        </section>
      )}
    </>
  );
}

// A round icon button with a caption underneath. Renders a link when `href`
// is set, otherwise a button.
function QuickAction({
  icon,
  label,
  href,
  onClick,
  disabled,
  pressed,
  primary,
  ariaLabel,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  // Solid fill for the main action (direct message).
  primary?: boolean;
  ariaLabel?: string;
}) {
  const circle = (
    <span
      className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
        pressed
          ? 'bg-accent text-gray-900'
          : primary
          ? 'bg-primary text-white group-hover:bg-secondary'
          : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
      }`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
  const caption = <span className="text-sm font-medium text-gray-700">{label}</span>;
  const className =
    'group flex w-16 flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50';

  if (href) {
    return href.startsWith('/') ? (
      <Link href={href} className={className}>
        {circle}
        {caption}
      </Link>
    ) : (
      <a href={href} className={className}>
        {circle}
        {caption}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={className}
    >
      {circle}
      {caption}
    </button>
  );
}
