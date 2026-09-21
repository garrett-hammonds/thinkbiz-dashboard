import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Shared frame for the public policy pages (privacy, terms). These are the
// pages the App Store and Google Play listings link to, so they render
// without a session, outside the (app) layout, and read plainly on a phone.
export default function DocPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
            <Image
              src="/thinkbiz-horizontal-logo.svg"
              alt="ThinkBiz Solutions"
              width={160}
              height={44}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <Link href="/login" className="text-sm font-semibold text-primary hover:text-secondary">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="rounded-xl border border-gray-100 bg-white p-6 shadow-card sm:p-10">
          <h1 className="text-3xl font-bold leading-snug text-foreground">{title}</h1>
          <p className="mt-3 text-base text-gray-600">{intro}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-gray-400">Last updated {updated}</p>

          <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-gray-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:font-medium [&_a]:text-primary hover:[&_a]:text-secondary [&_p+p]:mt-3">
            {children}
          </div>
        </article>

        <nav aria-label="Policy pages" className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-primary">Privacy</Link>
          <Link href="/terms" className="hover:text-primary">Terms</Link>
          <Link href="/support" className="hover:text-primary">Support</Link>
          <Link href="/login" className="hover:text-primary">Sign in</Link>
        </nav>
      </main>
    </div>
  );
}
