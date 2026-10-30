"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Shield } from "lucide-react";
import { getMyChatUnreadTotal } from "@/app/actions/chat";
import { SidebarNav } from "./SidebarNav";
import { MobileTopBar } from "./MobileTopBar";
import { SidebarDrawer } from "./SidebarDrawer";
import { ChatUnreadContext } from "./chatUnread";
import type { SwitcherClub } from "../ClubSwitcher";
import type { NavVisibility } from "./navItems";

const COLLAPSE_COOKIE = "tb_sidebar_collapsed";

// Top-level authed chrome: a persistent desktop sidebar (collapsible to an
// icon rail) plus a mobile top bar + off-canvas drawer, wrapped around the
// routed page content. Rendered once by app/(app)/layout.tsx so its collapse
// and drawer state survive navigation between authed routes.
//
// The desktop rail only appears at `lg` (>=1024px). Below that — phones,
// tablets, and any browser reporting a narrow/desktop-fallback viewport (e.g.
// an in-app webview or a phone that renders at ~980px) — the sidebar collapses
// into the hamburger drawer so the content is never squeezed behind a rail.
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

  // The menu's chat badge. `chatUnread` is computed when the layout renders,
  // which App Router only does on a full load or a server refresh, so on its
  // own the badge kept counting messages that had since been read. The chat
  // screen reports its live total through ChatUnreadContext; elsewhere the
  // count is re-fetched on navigation and when the app comes back to the
  // foreground. The chat screen is the source of truth while it's open.
  const [liveUnread, setLiveUnread] = useState(chatUnread);
  const [serverUnread, setServerUnread] = useState(chatUnread);
  if (chatUnread !== serverUnread) {
    setServerUnread(chatUnread);
    setLiveUnread(chatUnread);
  }

  const pathname = usePathname();
  const lastPathname = useRef(pathname);
  const isLoggedIn = visibility.isLoggedIn;

  useEffect(() => {
    if (pathname === lastPathname.current) return;
    lastPathname.current = pathname;
    if (!isLoggedIn || pathname.startsWith("/chat")) return;
    let cancelled = false;
    getMyChatUnreadTotal()
      .then((total) => {
        if (!cancelled) setLiveUnread(total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (window.location.pathname.startsWith("/chat")) return;
      getMyChatUnreadTotal().then(setLiveUnread).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isLoggedIn]);

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
    <ChatUnreadContext.Provider value={setLiveUnread}>
      <div className="lg:flex lg:items-start">
        {/* Desktop sidebar */}
        <aside
          className={[
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card lg:flex",
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
              chatUnread={liveUnread}
              collapsed={collapsed}
              isAdmin={isAdmin}
              switcherClubs={switcherClubs}
              activeClubId={activeClubId}
            />
          </div>
        </aside>

        {/* Content column. Pages render a `<main className="mx-auto max-w-... ">`
            directly here; because this column is a flex container, a child with
            auto horizontal margins (mx-auto) would shrink to its content width
            and float in the middle of wide viewports instead of filling to its
            max-width. `[&>main]:w-full` forces the page main to fill the column
            (still capped by its own max-w-* and centered beyond it), so content
            spans the screen on tablets and any zoomed-out/desktop-fallback
            viewport rather than collapsing into a narrow, tiny column. */}
        <div className="app-column flex min-h-dvh w-full min-w-0 flex-col bg-background [&>main]:w-full">
          <MobileTopBar
            onOpen={() => setDrawerOpen(true)}
            isOpen={drawerOpen}
            chatUnread={liveUnread}
          />
          {children}
        </div>

        {/* Mobile drawer */}
        <SidebarDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          visibility={visibility}
          chatUnread={liveUnread}
          isAdmin={isAdmin}
          switcherClubs={switcherClubs}
          activeClubId={activeClubId}
        />
      </div>
    </ChatUnreadContext.Provider>
  );
}
