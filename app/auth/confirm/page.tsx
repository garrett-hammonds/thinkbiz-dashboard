import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import SubmitButton from '@/components/SubmitButton';
import { confirmAuthLink } from './actions';
import { safeNextPath } from '@/utils/safeRedirect';

// Landing page for every auth email link (password reset, invite, magic link).
//
// Auth links carry a ONE-TIME token. We deliberately do NOT verify it when this
// page loads — loading is a GET, and email security scanners, antivirus, Gmail
// link-prefetch and chat link previews all fire GETs on links in emails before
// (or instead of) the human. If we verified on load, that first automated GET
// would spend the token and the real member's click would land on "link expired
// or already used" — which is exactly what was happening in production.
//
// Instead the member presses "Continue", which POSTs to the confirmAuthLink
// server action. Verification happens only there, behind a real click that
// passive prefetches can't trigger, so the token survives for the human.

const COPY: Record<string, { heading: string; body: string }> = {
  recovery: {
    heading: 'Reset your password',
    body: 'You asked to reset your ThinkBiz Solutions password. Click below to continue and choose a new one.',
  },
  invite: {
    heading: 'Accept your invitation',
    body: 'Welcome to ThinkBiz Solutions! Click below to continue and finish setting up your account.',
  },
  magiclink: {
    heading: 'Sign in to ThinkBiz Solutions',
    body: 'Click below to finish signing in to your account.',
  },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;

  // No token to confirm — send them somewhere useful rather than show a dead end.
  if (!token_hash || !type) {
    redirect(
      '/login?message=' +
        encodeURIComponent(
          'That sign-in link is missing information. Use "Forgot password" on the login page to get a fresh one.',
        ),
    );
  }

  const copy = COPY[type] ?? {
    heading: 'Continue to ThinkBiz Solutions',
    body: 'Click below to continue.',
  };
  const safeNext = safeNextPath(next);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-100 shadow-card p-8 text-center">
          <h1 className="text-3xl font-bold leading-snug text-foreground mb-2">{copy.heading}</h1>
          <p className="text-sm text-gray-500 mb-6">{copy.body}</p>

          <form action={confirmAuthLink}>
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={safeNext} />
            <SubmitButton
              pendingLabel="One moment…"
              className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary"
            >
              Continue
            </SubmitButton>
          </form>
        </div>
      </main>
    </div>
  );
}
