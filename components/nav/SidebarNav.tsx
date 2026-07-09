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
//
// Two visual variants share the same structure and data:
//  - default: the compact desktop rail (with an icon-only collapsed mode)
//  - large:   the full-screen mobile menu — the same visual language as the
//             rail (icons, rounded rows, teal border-l active state) scaled up
//             to thumb-sized targets, since the drawer owns the whole screen.
export function SidebarNav({
  visibility,
  chatUnread,
  collapsed = false,
  large = false,
  onNavigate,
  isAdmin,
  switcherClubs = [],
  activeClubId = null,
}: {
  visibility: NavVisibility;
  chatUnread: number;
  collapsed?: boolean;
  // Full-screen mobile menu styling (see above). Mutually exclusive with
  // `collapsed`, which only applies to the desktop rail.
  large?: boolean;
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
    const label = large ? (item.mobileLabel ?? item.label) : item.label;
    const showBadge = item.badge === "chatUnread" && chatUnread > 0;
    const badgeText = chatUnread > 99 ? "99+" : String(chatUnread);

    if (large) {
      // Same visual language as the desktop rail (icon + label, rounded row,
      // teal border-l active state), scaled up for thumbs and small screens.
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={[
            "flex items-center gap-3 rounded-lg border-l-2 px-3 py-3 text-xl transition-colors",
            active
              ? "border-primary bg-muted font-semibold text-foreground"
              : "border-transparent font-medium text-foreground hover:bg-muted",
          ].join(" ")}
        >
          <Icon
            className={[
              "h-6 w-6 shrink-0",
              active ? "text-primary" : "text-muted-foreground",
            ].join(" ")}
            aria-hidden="true"
          />
          <span className="truncate">{label}</span>

          {item.adminMark && (
            <Shield
              className="ml-auto h-4 w-4 shrink-0 text-primary opacity-70"
              aria-hidden="true"
            />
          )}

          {showBadge && (
            <span
              className={[
                "inline-flex min-w-6 items-center justify-center rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-gray-900",
                item.adminMark ? "" : "ml-auto",
              ].join(" ")}
            >
              {badgeText}
            </span>
          )}
        </Link>
      );
    }

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
          "flex-1 overflow-y-auto",
          large ? "px-4 py-5" : collapsed ? "px-2 py-4" : "px-3 py-4",
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
            <div key={section} className={large ? "mt-7" : "mt-5"}>
              {label && !collapsed && (
                <p
                  className={
                    large
                      ? "mb-2 px-3 text-sm font-bold uppercase tracking-wide text-muted-foreground"
                      : "mb-2 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                  }
                >
                  {label}
                </p>
              )}

              {showClubSwitcher && (
                <div className={large ? "mb-3 px-3" : "mb-2 px-1"}>
                  <ClubSwitcher
                    clubs={switcherClubs}
                    activeClubId={activeClubId}
                    className="w-full"
                    large={large}
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
            "border-t border-border",
            large ? "px-4 py-4" : collapsed ? "px-2 py-3" : "px-3 py-3",
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
                  "flex items-center rounded-lg bg-primary text-primary-foreground transition-colors",
                  large
                    ? "justify-center gap-2.5 px-6 py-3 text-lg font-semibold hover:bg-secondary"
                    : "font-medium hover:bg-primary/90",
                  !large && collapsed ? "justify-center px-0 py-2.5 text-sm" : "",
                  !large && !collapsed ? "justify-center gap-2 px-4 py-2 text-sm" : "",
                ].join(" ")}
              >
                <Icon
                  className={large ? "h-5 w-5 shrink-0" : "h-4 w-4 shrink-0"}
                  aria-hidden="true"
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
