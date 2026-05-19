import Link from "next/link";
import Image from "next/image";
import { User, LifeBuoy, Shield, ClipboardList, UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getMemberForUser } from "@/utils/supabase/getMember";
import { MobileMenu } from "./mobile-menu";

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let canViewApps = false;
  let isAdmin = false;

  if (user) {
    const member = await getMemberForUser(supabase, user);
    canViewApps = !!(member?.is_admin || member?.club_director);
    isAdmin = !!member?.is_admin;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <nav className="mx-auto flex h-20 md:h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={user ? "/dashboard" : "/login"}
          className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
        >
          <Image
            src="/ThinkbizEmblem.png"
            alt="ThinkBiz Icon"
            width={32}
            height={32}
            priority
          />
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
            <Image
              src="/thinkbiz-logo-horizontal.png"
              alt="ThinkBiz Solutions Logo"
              width={150}
              height={40}
              priority
            />
            {(isAdmin || canViewApps) && (
              <span className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs font-bold text-foreground w-fit">
                <Shield className="h-3 w-3" />
                {isAdmin ? 'Admin' : 'Director'}
              </span>
            )}
          </div>
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
              href="/dashboard/applications"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Applications
              <Shield className="inline-block w-3 h-3 ml-1.5 opacity-70" />
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

        <MobileMenu canViewApps={canViewApps} isAdmin={isAdmin} isLoggedIn={!!user} />
      </nav>
    </header>
  );
}
