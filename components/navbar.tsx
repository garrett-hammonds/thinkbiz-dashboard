import Link from "next/link";
import Image from "next/image";
import { User, LifeBuoy, Shield, ClipboardList, UserPlus, MessageSquare, Users, Rocket } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getMemberForUser } from "@/utils/supabase/getMember";
import { MobileMenu } from "./mobile-menu";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let canViewApps = false;
  let isAdmin = false;
  let chatUnread = 0;

  if (user) {
    const member = await getMemberForUser(supabase, user);
    canViewApps = !!(member?.is_admin || member?.club_director);
    isAdmin = !!member?.is_admin;

    // Errors (e.g. chat migration not applied yet) just leave the badge at 0
    const { data: unreadRows } = await supabase.rpc('chat_unread_counts');
    if (unreadRows) {
      chatUnread = (unreadRows as { unread: number }[]).reduce(
        (sum, row) => sum + Number(row.unread), 0
      );
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      {user && <ServiceWorkerRegister />}
      <nav className="mx-auto flex h-24 md:h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={user ? "/dashboard" : "/login"}
          className="flex flex-col md:flex-row md:items-center gap-2.5 md:gap-3 text-foreground transition-opacity hover:opacity-80"
        >
          <Image
            src="/thinkbiz-horizontal-logo.svg"
            alt="ThinkBiz Solutions Logo"
            width={160}
            height={44}
            priority
            className="h-8 w-auto"
          />
          {(isAdmin || canViewApps) && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs font-bold text-foreground w-fit">
              <Shield className="h-3 w-3" />
              {isAdmin ? 'Admin' : 'Director'}
            </span>
          )}
        </Link>

        <div className="hidden md:flex items-center gap-1 sm:gap-2">
          {isAdmin && (
            <Link
              href="/dashboard/invite-director"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite Director
              <Shield className="inline-block w-3 h-3 ml-1.5 opacity-70" />
            </Link>
          )}

          {canViewApps && (
            <Link
              href="/dashboard/roster"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              Members
              <Shield className="inline-block w-3 h-3 ml-1.5 opacity-70" />
            </Link>
          )}

          {canViewApps && (
            <Link
              href="/dashboard/applications"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Applications
              <Shield className="inline-block w-3 h-3 ml-1.5 opacity-70" />
            </Link>
          )}

          {user && (
            <Link
              href="/chat"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Chat
              {chatUnread > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-gray-900">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              )}
            </Link>
          )}

          {user && (
            <Link
              href="/getting-started"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              Getting Started
            </Link>
          )}

          <Link
            href="/support"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Support
          </Link>

          {user && (
            <a
              href="/profile"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">My Account</span>
            </a>
          )}

          {user && (
            <Link
              href="/log"
              className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
            >
              Success Tracking
            </Link>
          )}
        </div>

        <MobileMenu canViewApps={canViewApps} isAdmin={isAdmin} isLoggedIn={!!user} chatUnread={chatUnread} />
      </nav>
    </header>
  );
}
