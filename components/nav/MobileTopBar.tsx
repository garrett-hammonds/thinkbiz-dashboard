"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";

// Slim top bar shown below `lg`. The sidebar itself lives off-canvas in a
// drawer; this bar just carries the brand and the hamburger that opens it.
// The breakpoint is `lg` (not `md`) so tablets and any narrow/zoomed-out
// viewport keep the hamburger rather than a persistent 16rem rail squeezing
// the content column.
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
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
          className="h-8 w-auto"
        />
      </Link>

      <button
        type="button"
        onClick={onOpen}
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls="app-sidebar-drawer"
        className="relative p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Menu className="h-6 w-6" />
        {chatUnread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
        )}
      </button>
    </header>
  );
}
