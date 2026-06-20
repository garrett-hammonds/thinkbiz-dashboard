'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  User,
  ClipboardList,
  Image as ImageIcon,
  Smartphone,
  BellRing,
} from 'lucide-react';
import {
  isPushSupported,
  isStandalone,
  subscribeToPush,
  getExistingSubscription,
} from '@/lib/notifications/push-client';

interface Props {
  profileCompleted: boolean;
  hasHeadshot: boolean;
  hasLoggedSuccess: boolean;
}

type PushState =
  | 'loading'
  | 'unsupported'
  | 'subscribed'
  | 'unsubscribed'
  | 'denied'
  | 'busy';

export default function GettingStartedChecklist({
  profileCompleted,
  hasHeadshot,
  hasLoggedSuccess,
}: Props) {
  // Client-only states: whether the app is installed to the Home Screen and
  // whether this browser is enrolled for push. Both are unknowable on the
  // server, so they start as null/loading and resolve after mount.
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [pushState, setPushState] = useState<PushState>('loading');
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      setInstalled(isStandalone());
      setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));

      if (!isPushSupported()) {
        setPushState('unsupported');
        return;
      }
      const existing = await getExistingSubscription();
      if (active) setPushState(existing ? 'subscribed' : 'unsubscribed');
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleEnablePush = async () => {
    setPushState('busy');
    const result = await subscribeToPush();
    if (result.ok) setPushState('subscribed');
    else if (result.reason === 'denied') setPushState('denied');
    else setPushState('unsubscribed');
  };

  const pushDone = pushState === 'subscribed';

  // Items that count toward the progress bar. The optional headshot is shown
  // but excluded from the count so it never blocks "all done".
  const coreSteps = [
    profileCompleted,
    hasLoggedSuccess,
    installed === true,
    pushDone,
  ];
  const completedCount = coreSteps.filter(Boolean).length;
  const totalCount = coreSteps.length;
  const allDone = completedCount === totalCount;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {allDone ? "You're all set! 🎉" : 'Your progress'}
          </p>
          <p className="text-sm text-gray-500">
            {completedCount} of {totalCount} complete
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* 1. Profile */}
      <ChecklistItem
        icon={<User className="h-5 w-5" />}
        title="Complete your profile"
        summary="Tell other members who you are and what you do."
        done={profileCompleted}
        defaultOpen={!profileCompleted}
      >
        <p className="text-sm text-gray-600">
          Your profile is what other members see when they look you up — your
          company, title, bio, skills and links. Keep it current so the right
          people can connect with you.
        </p>
        <ActionLink href="/profile" done={profileCompleted}>
          {profileCompleted ? 'Review my profile' : 'Complete my profile'}
        </ActionLink>
      </ChecklistItem>

      {/* 2. First success tracking */}
      <ChecklistItem
        icon={<ClipboardList className="h-5 w-5" />}
        title="Log your first success tracking numbers"
        summary="Record visitors, one-on-ones, referrals and closed business."
        done={hasLoggedSuccess}
        defaultOpen={!hasLoggedSuccess}
      >
        <p className="text-sm text-gray-600">
          Each week, log the visitors you brought, one-on-ones you had,
          referrals you gave, and any closed business you want to thank a fellow
          member for. Your dashboard charts come straight from these numbers.
        </p>
        <ActionLink href="/log" done={hasLoggedSuccess}>
          {hasLoggedSuccess ? 'Log this week' : 'Log my first numbers'}
        </ActionLink>
      </ChecklistItem>

      {/* 3. Headshot (optional) */}
      <ChecklistItem
        icon={<ImageIcon className="h-5 w-5" />}
        title="Add a headshot"
        summary="Put a face to your name in the member directory."
        done={hasHeadshot}
        optional
        defaultOpen={false}
      >
        <p className="text-sm text-gray-600">
          A friendly photo helps members recognize you at meetings and when they
          refer business your way. You can upload one from your profile page.
        </p>
        <ActionLink href="/profile" done={hasHeadshot}>
          {hasHeadshot ? 'Update my headshot' : 'Add a headshot'}
        </ActionLink>
      </ChecklistItem>

      {/* 4. Add app to phone */}
      <ChecklistItem
        icon={<Smartphone className="h-5 w-5" />}
        title="Add ThinkBiz to your phone"
        summary="Install the dashboard like an app for one-tap access."
        done={installed === true}
        defaultOpen={installed === false}
      >
        <p className="text-sm text-gray-600">
          Adding ThinkBiz to your Home Screen gives you a real app icon and a
          full-screen experience — and on iPhone it&apos;s required before you
          can turn on push notifications.
        </p>

        <Steps>
          <Step n={1}>
            Open this dashboard in your phone&apos;s browser
            {isIOS ? ' (Safari on iPhone/iPad)' : ' (Chrome on Android)'}.
          </Step>
          <Step n={2}>
            {isIOS ? (
              <>
                Tap the <strong>Share</strong> button, then choose{' '}
                <strong>Add to Home Screen</strong>.
              </>
            ) : (
              <>
                Tap the <strong>⋮</strong> menu in the top right, then choose{' '}
                <strong>Add to Home screen</strong>.
              </>
            )}
          </Step>
          <Step n={3}>
            Confirm, then open ThinkBiz from the new icon on your Home Screen.
          </Step>
        </Steps>

        <Screenshot
          src="/getting-started/add-to-home-screen.png"
          alt="Browser menu with 'Add to Home screen' highlighted"
          caption="In your browser menu, tap “Add to Home screen.”"
        />

        {installed === true ? (
          <DoneNote>You&apos;re running ThinkBiz as an installed app.</DoneNote>
        ) : installed === false ? (
          <p className="mt-3 text-sm text-gray-500">
            Already added it? Open ThinkBiz from the Home Screen icon and this
            step will check off automatically.
          </p>
        ) : null}
      </ChecklistItem>

      {/* 5. Push notifications */}
      <ChecklistItem
        icon={<BellRing className="h-5 w-5" />}
        title="Turn on push notifications"
        summary="Get alerts for chat messages and reminders, even when closed."
        done={pushDone}
        defaultOpen={!pushDone}
      >
        <p className="text-sm text-gray-600">
          Push notifications let ThinkBiz reach you for new chat messages,
          mentions, and weekly log reminders — even when the dashboard is
          closed.
        </p>

        {isIOS && installed === false && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            On iPhone or iPad, finish &ldquo;Add ThinkBiz to your phone&rdquo;
            above first, then open the app from your Home Screen — push
            notifications only work from the installed app.
          </div>
        )}

        <Steps>
          <Step n={1}>
            Open the menu and go to <strong>My Account</strong>.
          </Step>
          <Step n={2}>
            Under <strong>Notifications</strong>, tap <strong>Enable push</strong>{' '}
            and allow notifications when your browser asks.
          </Step>
        </Steps>

        <div className="grid gap-4 sm:grid-cols-2">
          <Screenshot
            src="/getting-started/open-my-account.png"
            alt="App menu with 'My Account' highlighted"
            caption="Open the menu and tap “My Account.”"
          />
          <Screenshot
            src="/getting-started/enable-push.png"
            alt="Notifications settings with 'Enable push' button highlighted"
            caption="Tap “Enable push” and allow notifications."
          />
        </div>

        {/* Convenience: members can enable right here without leaving the page. */}
        <div className="mt-4">
          {pushState === 'subscribed' ? (
            <DoneNote>Push notifications are on for this device.</DoneNote>
          ) : (
            <>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={
                  pushState === 'unsupported' ||
                  pushState === 'busy' ||
                  pushState === 'loading'
                }
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pushState === 'busy' ? 'Enabling…' : 'Enable push on this device'}
              </button>
              {pushState === 'denied' && (
                <p className="mt-3 text-sm text-red-700">
                  Notifications are blocked for this site. Allow them in your
                  browser settings, then try again.
                </p>
              )}
              {pushState === 'unsupported' && !isIOS && (
                <p className="mt-3 text-sm text-gray-500">
                  This browser doesn&apos;t support push notifications. Try
                  Chrome on Android or Safari on an installed iPhone app.
                </p>
              )}
            </>
          )}
        </div>
      </ChecklistItem>

      {allDone && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
          <p className="text-sm font-semibold text-foreground">
            Nice work — you&apos;re fully set up.
          </p>
          <Link
            href="/dashboard"
            className="mt-3 inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary"
          >
            Go to my dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({
  icon,
  title,
  summary,
  done,
  optional,
  defaultOpen,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  summary: string;
  done: boolean;
  optional?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <span className={done ? 'text-primary' : 'text-gray-300'}>
          {done ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <Circle className="h-6 w-6" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-gray-400">{icon}</span>
            <span
              className={`font-semibold text-foreground ${
                done ? 'line-through decoration-gray-300' : ''
              }`}
            >
              {title}
            </span>
            {optional && (
              <span className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
                Optional
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-sm text-gray-500">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="space-y-4 border-t border-gray-100 px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function ActionLink({
  href,
  done,
  children,
}: {
  href: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        done
          ? 'inline-flex rounded-lg border-2 border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white'
          : 'inline-flex rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary'
      }
    >
      {children}
    </Link>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2.5">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-gray-700">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function Screenshot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="overflow-hidden rounded-lg border border-gray-200 bg-slate-50">
      {/* Static instructional screenshots — plain img keeps it simple and
          avoids next/image config for these decorative assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="mx-auto block max-h-80 w-auto" />
      <figcaption className="border-t border-gray-200 px-3 py-2 text-center text-xs text-gray-500">
        {caption}
      </figcaption>
    </figure>
  );
}

function DoneNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
}
