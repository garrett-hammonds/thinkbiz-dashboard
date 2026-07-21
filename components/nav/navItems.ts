import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ClipboardList,
  UserPlus,
  UserCheck,
  QrCode,
  MessageSquare,
  BookUser,
  Rocket,
  User,
  LifeBuoy,
  LineChart,
} from "lucide-react";

// Single source of truth for the sidebar navigation. Both the desktop rail and
// the mobile drawer render from this list (via SidebarNav), which is what keeps
// them from drifting apart the way the old navbar.tsx / mobile-menu.tsx pair did.

// Who can see an item. Resolved against the role flags fetched server-side in
// the (app) layout.
export type NavGate = "always" | "loggedIn" | "canViewApps" | "isAdmin";

// Sidebar groupings, rendered top-to-bottom. `primary` items (Dashboard) sit at
// the top with no section label; the pinned Success Tracking action is handled
// separately via the `primary` flag below.
export type NavSection = "primary" | "manage" | "club" | "account";

export interface NavItem {
  href: string;
  label: string;
  // Some items read differently in the narrower mobile drawer (e.g. the
  // check-in code). Falls back to `label` when unset.
  mobileLabel?: string;
  icon: LucideIcon;
  section: NavSection;
  gate: NavGate;
  // Renders the chat unread pill / dot.
  badge?: "chatUnread";
  // Small Shield mark on director/admin-only surfaces (preserved from the old
  // navbar, which flagged these with an inline Shield).
  adminMark?: boolean;
  // Rendered as the filled primary button pinned to the bottom of the sidebar,
  // outside the normal sections.
  primary?: boolean;
}

export const SECTION_LABELS: Record<NavSection, string | null> = {
  primary: null,
  manage: "Manage",
  club: "My Club",
  account: "Account & Help",
};

// Order within each section is significant.
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    section: "primary",
    gate: "loggedIn",
  },

  // Manage — director/admin surfaces
  {
    href: "/dashboard/roster",
    label: "Members",
    icon: Users,
    section: "manage",
    gate: "canViewApps",
    adminMark: true,
  },
  {
    href: "/dashboard/attendance",
    label: "Attendance",
    icon: CalendarCheck,
    section: "manage",
    gate: "canViewApps",
    adminMark: true,
  },
  {
    href: "/dashboard/applications",
    label: "Applications",
    icon: ClipboardList,
    section: "manage",
    gate: "canViewApps",
    adminMark: true,
  },
  {
    href: "/dashboard/invite-director",
    label: "Invite Director",
    icon: UserPlus,
    section: "manage",
    gate: "isAdmin",
    adminMark: true,
  },

  // My Club — member tools
  {
    href: "/dashboard/visitors",
    label: "Visitors",
    icon: UserCheck,
    section: "club",
    gate: "loggedIn",
  },
  {
    href: "/check-in-code",
    label: "Check-In",
    mobileLabel: "My Check-In Code",
    icon: QrCode,
    section: "club",
    gate: "loggedIn",
  },
  {
    href: "/directory",
    label: "Directory",
    mobileLabel: "Member Directory",
    icon: BookUser,
    section: "club",
    gate: "loggedIn",
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessageSquare,
    section: "club",
    gate: "loggedIn",
    badge: "chatUnread",
  },

  // Account & Help
  {
    href: "/getting-started",
    label: "Getting Started",
    icon: Rocket,
    section: "account",
    gate: "loggedIn",
  },
  {
    href: "/profile",
    label: "My Account",
    icon: User,
    section: "account",
    gate: "loggedIn",
  },
  {
    href: "/support",
    label: "Support",
    icon: LifeBuoy,
    section: "account",
    gate: "always",
  },

  // Pinned bottom — primary call to action
  {
    href: "/log",
    label: "Success Tracking",
    icon: LineChart,
    section: "primary",
    gate: "loggedIn",
    primary: true,
  },
];

export interface NavVisibility {
  isLoggedIn: boolean;
  canViewApps: boolean;
  isAdmin: boolean;
}

export function canSeeItem(item: NavItem, v: NavVisibility): boolean {
  switch (item.gate) {
    case "always":
      return true;
    case "loggedIn":
      return v.isLoggedIn;
    case "canViewApps":
      return v.canViewApps;
    case "isAdmin":
      return v.isAdmin;
  }
}

// Active-route matching. `/dashboard` must match exactly, otherwise every nested
// route (/dashboard/roster, /dashboard/visitors, …) would also light it up.
// Section leaves match themselves and any deeper path.
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
