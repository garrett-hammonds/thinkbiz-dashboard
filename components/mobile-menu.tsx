"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User, LifeBuoy, Menu, X, UserPlus, Shield, ClipboardList } from "lucide-react";

export function MobileMenu({ canViewApps, isAdmin, isLoggedIn }: { canViewApps: boolean; isAdmin: boolean; isLoggedIn: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="md:hidden p-2 text-muted-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="md:hidden border-t p-6 flex flex-col gap-4 absolute top-20 md:top-14 left-0 w-full bg-card shadow-lg z-50">
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
              href="/dashboard/applications"
              className="flex w-full justify-start items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Applications
              <Shield className="h-4 w-4 ml-auto text-primary opacity-70" />
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
      )}
    </>
  );
}
