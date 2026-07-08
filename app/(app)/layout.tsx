import { createClient } from "@/utils/supabase/server";
import { getMemberForUser } from "@/utils/supabase/getMember";
import { getSelectedClubId } from "@/utils/activeClub";
import { cookies } from "next/headers";
import { AppShell } from "@/components/nav/AppShell";
import type { SwitcherClub } from "@/components/ClubSwitcher";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// Shared layout for every authenticated surface. This is where the sidebar
// chrome lives, and it owns the role/unread/club data-fetch that used to sit
// in the (now removed) Navbar server component. App Router keeps this layout
// mounted across navigations, so the sidebar's collapse and drawer state
// persist and this fetch runs once per layout render rather than per page.
//
// Individual pages still enforce their own auth (redirect('/login')); this
// layout only renders defensively for the logged-out case (e.g. /support,
// which is publicly reachable) by gating everything on `user`.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let canViewApps = false;
  let isAdmin = false;
  let chatUnread = 0;
  let switcherClubs: SwitcherClub[] = [];
  let activeClubId: string | null = null;

  if (user) {
    const member = await getMemberForUser(supabase, user);
    canViewApps = !!(member?.is_admin || member?.club_director);
    isAdmin = !!member?.is_admin;

    // Admins get a club switcher so they can manage any club's director
    // surfaces, not just their own. Everyone else stays on their own club.
    if (isAdmin) {
      const { data: clubsData } = await supabase
        .from("clubs")
        .select("id, name, display_name")
        .order("name");
      switcherClubs = (clubsData ?? []).map((c) => ({
        id: c.id,
        label: c.display_name || c.name,
      }));
      activeClubId = await getSelectedClubId();
    }

    // Errors (e.g. chat migration not applied yet) just leave the badge at 0
    const { data: unreadRows } = await supabase.rpc("chat_unread_counts");
    if (unreadRows) {
      chatUnread = (unreadRows as { unread: number }[]).reduce(
        (sum, row) => sum + Number(row.unread),
        0,
      );
    }
  }

  const cookieStore = await cookies();
  const initialCollapsed =
    cookieStore.get("tb_sidebar_collapsed")?.value === "1";

  return (
    <>
      {user && <ServiceWorkerRegister />}
      <AppShell
        initialCollapsed={initialCollapsed}
        visibility={{ isLoggedIn: !!user, canViewApps, isAdmin }}
        chatUnread={chatUnread}
        isAdmin={isAdmin}
        switcherClubs={switcherClubs}
        activeClubId={activeClubId}
      >
        {children}
      </AppShell>
    </>
  );
}
