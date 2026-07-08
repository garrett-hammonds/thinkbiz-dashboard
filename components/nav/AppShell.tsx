"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronsLeft, ChevronsRight, Shield } from "lucide-react";
import { SidebarNav } from "./SidebarNav";
import { MobileTopBar } from "./MobileTopBar";
import { SidebarDrawer } from "./SidebarDrawer";
import type { SwitcherClub } from "../ClubSwitcher";
import type { NavVisibility } from "./navItems";

const COLLAPSE_COOKIE = "tb_sidebar_collapsed";

// Top-level authed chrome: a persistent desktop sidebar (collapsible to an
// icon rail) plus a mobile top bar + off-canvas drawer, wrapped around the
// routed page content. Rendered once by app/(app)/layout.tsx so its collapse
// and drawer state survive navigation between authed routes.
export function AppShell({
  children,
  initialCollapsed,
  visibility,
  chatUnread,
  isAdmin,
  switcherClubs = [],
  activeClubId = null,
}: {
  children: React.ReactNode;
  initialCollapsed: boolean;
  visibility: NavVisibility;
  chatUnread: number;
  isAdmin: boolean;
  switcherClubs?: SwitcherClub[];
  activeClubId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const showRoleBadge = isAdmin || visibility.canViewApps;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      // Seed the next SSR render so the correct width paints immediately (no
      // hydration flash). Mirrors the cookie convention used by the club
      // switcher's setActiveClub action.
      document.cookie = `${COLLAPSE_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${
        60 * 60 * 24 * 365
      }; samesite=lax`;
      return next;
    });
  };

  return (
    <div className="md:flex md:items-start">
      {/* Desktop sidebar */}
      <aside
        className={[
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card md:flex",
          collapsed ? "w-16" : "w-64",
        ].join(" ")}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 border-b border-border py-3">
            <Link
              href="/dashboard"
              aria-label="ThinkBiz dashboard"
              className="flex items-center transition-opacity hover:opacity-80"
            >
              <Image
                src="/ThinkbizEmblem.png"
                alt="ThinkBiz Solutions"
                width={32}
                height={32}
                priority
                className="h-8 w-8"
              />
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Image
                src="/thinkbiz-horizontal-logo.svg"
                alt="ThinkBiz Solutions"
                width={160}
                height={44}
                priority
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
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <SidebarNav
            visibility={visibility}
            chatUnread={chatUnread}
            collapsed={collapsed}
            isAdmin={isAdmin}
            switcherClubs={switcherClubs}
            activeClubId={activeClubId}
          />
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-h-dvh w-full min-w-0 flex-col bg-background">
        <MobileTopBar
          onOpen={() => setDrawerOpen(true)}
          isOpen={drawerOpen}
          chatUnread={chatUnread}
        />
        {children}
      </div>

      {/* Mobile drawer */}
      <SidebarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        visibility={visibility}
        chatUnread={chatUnread}
        isAdmin={isAdmin}
        switcherClubs={switcherClubs}
        activeClubId={activeClubId}
      />
    </div>
  );
}
