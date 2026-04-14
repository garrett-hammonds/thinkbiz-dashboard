"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User, LifeBuoy, Menu, X } from "lucide-react";

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
        >
          <Image
            src="/ThinkbizEmblem.png"
            alt="ThinkBiz Icon"
            width={32}
            height={32}
            priority
          />
          <Image
            src="/thinkbiz-logo-horizontal.png"
            alt="ThinkBiz Solutions Logo"
            width={150}
            height={40}
            priority
          />
        </Link>

        <div className="hidden md:flex items-center gap-1 sm:gap-2">
          <Link
            href="/log"
            className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
          >
            Submit Report
          </Link>

          <Link
            href="/support"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Support
          </Link>

          <a
            href="/profile"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">My Account</span>
          </a>
        </div>

        <button
          className="md:hidden p-2 text-muted-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t p-4 flex flex-col gap-4">
          <Link
            href="/log"
            className="flex w-full justify-start items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Submit Report
          </Link>

          <Link
            href="/support"
            className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Support
          </Link>

          <a
            href="/profile"
            className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <User className="h-4 w-4" aria-hidden="true" />
            <span>My Account</span>
          </a>
        </div>
      )}
    </header>
  );
}
