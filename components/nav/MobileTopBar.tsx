"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

// Top bar shown below `lg`. The sidebar itself lives off-canvas in a
// drawer; this bar just carries the brand and the hamburger that opens it.
// The breakpoint is `lg` (not `md`) so tablets and any narrow/zoomed-out
// viewport keep the hamburger rather than a persistent 16rem rail squeezing
// the content column.
//
// Generous height and a large hamburger are deliberate: this is the app's
// primary navigation control on mobile, so it gets a comfortably-over-44px
// tap target and enough vertical padding to read as a header, not a strip.
export function MobileTopBar({
  onOpen,
  isOpen,
  chatUnread,
}: {
  onOpen: () => void;
  isOpen: boolean;
  chatUnread: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-5 py-4 lg:hidden">
      <Link
        href="/dashboard"
        className="flex items-center transition-opacity hover:opacity-80"
      >
        <Image
          src="/thinkbiz-horizontal-logo.svg"
          alt="ThinkBiz Solutions"
          width={160}
          height={44}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <button
        type="button"
        onClick={onOpen}
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls="app-sidebar-drawer"
        className="relative -mr-2 rounded-lg p-3 text-foreground transition-colors hover:bg-muted"
      >
        <Menu className="h-8 w-8" />
        {chatUnread > 0 && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card" />
        )}
      </button>
    </header>
  );
}
