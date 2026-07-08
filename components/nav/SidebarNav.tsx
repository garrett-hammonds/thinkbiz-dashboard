"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { ClubSwitcher, type SwitcherClub } from "../ClubSwitcher";
import {
  NAV_ITEMS,
  SECTION_LABELS,
  canSeeItem,
  isNavItemActive,
  type NavItem,
  type NavSection,
  type NavVisibility,
} from "./navItems";

// The shared body of the sidebar: grouped nav items, the admin club switcher,
// and the pinned Success Tracking action. Rendered by BOTH the desktop rail and
// the mobile drawer so the two can never drift apart. The containers own the
// brand header, the outer width, and the collapse/close controls.
export function SidebarNav({
  visibility,
  chatUnread,
  collapsed = false,
  onNavigate,
  isAdmin,
  switcherClubs = [],
  activeClubId = null,
}: {
  visibility: NavVisibility;
  chatUnread: number;
  collapsed?: boolean;
  // Called when a link is clicked (used by the mobile drawer to close itself).
  onNavigate?: () => void;
  isAdmin: boolean;
  switcherClubs?: SwitcherClub[];
  activeClubId?: string | null;
}) {
  const pathname = usePathname();

  const visible = (item: NavItem) => canSeeItem(item, visibility);
  const topItems = NAV_ITEMS.filter(
    (i) => i.section === "primary" && !i.primary && visible(i),
  );
  const pinnedItems = NAV_ITEMS.filter((i) => i.primary && visible(i));
  const bodySections: NavSection[] = ["manage", "club", "account"];

  const renderLink = (item: NavItem) => {
    const active = isNavItemActive(item.href, pathname);
    const Icon = item.icon;
    const label = item.label;
    const showBadge = item.badge === "chatUnread" && chatUnread > 0;
    const badgeText = chatUnread > 99 ? "99+" : String(chatUnread);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        className={[
          "group relative flex items-center rounded-lg border-l-2 text-sm transition-colors",
          collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
          active
            ? "border-primary bg-muted font-medium text-foreground"
            : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        ].join(" ")}
      >
        <span className="relative flex shrink-0 items-center">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {/* Collapsed rail can't show the count pill, so surface unread as a dot. */}
          {showBadge && collapsed && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
          )}
        </span>

        {!collapsed && <span className="truncate">{label}</span>}

        {!collapsed && item.adminMark && (
          <Shield
            className="ml-auto h-3 w-3 shrink-0 text-primary opacity-70"
            aria-hidden="true"
          />
        )}

        {!collapsed && showBadge && (
          <span
            className={[
              "inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-gray-900",
              item.adminMark ? "" : "ml-auto",
            ].join(" ")}
          >
            {badgeText}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav
        className={[
          "flex-1 overflow-y-auto py-4",
          collapsed ? "px-2" : "px-3",
        ].join(" ")}
        aria-label="Primary"
      >
        {/* Primary (Dashboard) */}
        <ul className="flex flex-col gap-1">
          {topItems.map((item) => (
            <li key={item.href}>{renderLink(item)}</li>
          ))}
        </ul>

        {bodySections.map((section) => {
          const items = NAV_ITEMS.filter(
            (i) => i.section === section && !i.primary && visible(i),
          );
          const showClubSwitcher =
            section === "manage" &&
            isAdmin &&
            switcherClubs.length > 0 &&
            !collapsed;

          if (items.length === 0 && !showClubSwitcher) return null;

          const label = SECTION_LABELS[section];

          return (
            <div key={section} className="mt-5">
              {label && !collapsed && (
                <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
              )}

              {showClubSwitcher && (
                <div className="mb-2 px-1">
                  <ClubSwitcher
                    clubs={switcherClubs}
                    activeClubId={activeClubId}
                    className="w-full"
                  />
                </div>
              )}

              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.href}>{renderLink(item)}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Pinned primary action (Success Tracking) */}
      {pinnedItems.length > 0 && (
        <div
          className={[
            "border-t border-border py-3",
            collapsed ? "px-2" : "px-3",
          ].join(" ")}
        >
          {pinnedItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={[
                  "flex items-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
                  collapsed
                    ? "justify-center px-0 py-2.5"
                    : "justify-center gap-2 px-4 py-2",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
