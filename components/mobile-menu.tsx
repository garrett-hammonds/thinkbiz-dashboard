"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, LifeBuoy, Menu, X, UserPlus, Shield, ClipboardList, MessageSquare, Users, UserCheck, Rocket } from "lucide-react";
import { ClubSwitcher, type SwitcherClub } from "./ClubSwitcher";

export function MobileMenu({ canViewApps, isAdmin, isLoggedIn, chatUnread = 0, switcherClubs = [], activeClubId = null }: { canViewApps: boolean; isAdmin: boolean; isLoggedIn: boolean; chatUnread?: number; switcherClubs?: SwitcherClub[]; activeClubId?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape so a keyboard user is never trapped with the menu open.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        className="md:hidden p-2 text-muted-foreground"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-menu-panel"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <>
          {/* Click-outside dismiss: a transparent backdrop beneath the panel. */}
          <div
            className="md:hidden fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />
          <div
            id="mobile-menu-panel"
            className="md:hidden border-t p-6 flex flex-col gap-4 absolute top-24 md:top-14 left-0 w-full bg-card shadow-lg z-50"
          >
          {isAdmin && switcherClubs.length > 0 && (
            <div className="pb-2 border-b border-border">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Managing club
              </p>
              <ClubSwitcher clubs={switcherClubs} activeClubId={activeClubId} />
            </div>
          )}

          {isAdmin && (
            <Link
              href="/dashboard/invite-director"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite Director
              <Shield className="h-4 w-4 ml-auto text-primary opacity-70" />
            </Link>
          )}

          {canViewApps && (
            <Link
              href="/dashboard/roster"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Members
              <Shield className="h-4 w-4 ml-auto text-primary opacity-70" />
            </Link>
          )}

          {canViewApps && (
            <Link
              href="/dashboard/applications"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Applications
              <Shield className="h-4 w-4 ml-auto text-primary opacity-70" />
            </Link>
          )}

          {isLoggedIn && (
            <Link
              href="/dashboard/visitors"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              Visitors
            </Link>
          )}

          {isLoggedIn && (
            <Link
              href="/chat"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Chat
              {chatUnread > 0 && (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-gray-900">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              )}
            </Link>
          )}

          {isLoggedIn && (
            <Link
              href="/getting-started"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              Getting Started
            </Link>
          )}

          <Link
            href="/support"
            className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setIsOpen(false)}
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Support
          </Link>

          {isLoggedIn && (
            <a
              href="/profile"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span>My Account</span>
            </a>
          )}

          {isLoggedIn && (
            <Link
              href="/log"
              className="flex w-full justify-start items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => setIsOpen(false)}
            >
              Success Tracking
            </Link>
          )}
          </div>
        </>
      )}
    </>
  );
}
