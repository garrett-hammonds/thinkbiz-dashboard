"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, X } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
import type { SwitcherClub } from "../ClubSwitcher";
import type { NavVisibility } from "./navItems";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Off-canvas mobile sidebar. Combines the open/close behaviour of the old
// mobile-menu (Escape, backdrop click, close-on-link-click) with the a11y
// conventions of Modal.tsx (focus move-in, Tab trap, scroll lock, focus
// restore). Renders the same SidebarNav body as the desktop rail.
export function SidebarDrawer({
  open,
  onClose,
  visibility,
  chatUnread,
  isAdmin,
  switcherClubs = [],
  activeClubId = null,
}: {
  open: boolean;
  onClose: () => void;
  visibility: NavVisibility;
  chatUnread: number;
  isAdmin: boolean;
  switcherClubs?: SwitcherClub[];
  activeClubId?: string | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const showRoleBadge = isAdmin || visibility.canViewApps;

  return (
    <div className="lg:hidden">
      {/* Backdrop — click to dismiss */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        id="app-sidebar-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
        className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-card shadow-lg focus:outline-none"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/thinkbiz-horizontal-logo.svg"
              alt="ThinkBiz Solutions"
              width={160}
              height={44}
              className="h-8 w-auto"
            />
            {showRoleBadge && (
              <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-bold text-foreground">
                <Shield className="h-3 w-3" />
                {isAdmin ? "Admin" : "Director"}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1">
          <SidebarNav
            visibility={visibility}
            chatUnread={chatUnread}
            onNavigate={onClose}
            isAdmin={isAdmin}
            switcherClubs={switcherClubs}
            activeClubId={activeClubId}
          />
        </div>
      </div>
    </div>
  );
}
