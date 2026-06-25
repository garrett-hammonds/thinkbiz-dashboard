import 'server-only';
import { cookies } from 'next/headers';

// Admins can "act as" the director of a club other than their own by switching
// the club view in the navbar. The selection is persisted in this cookie.
//
// Non-admins never set it, and `getActiveClubId` ignores it for them, so a
// member who is later demoted from admin can't keep an old override alive.
export const ACTIVE_CLUB_COOKIE = 'tb_active_club';

type ClubScopedMember = {
  is_admin?: boolean | null;
  current_club_id?: string | null;
};

// The club an admin has explicitly selected to manage, or null when "All clubs"
// (no override) is chosen. Only meaningful for admins — the club switcher that
// writes the cookie is admin-only.
export async function getSelectedClubId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_CLUB_COOKIE)?.value || null;
}

// The club whose data the club-scoped director surfaces (roster, visitors,
// check-in QR, dashboard club stats) should show.
//
// For an admin this is their selected club, falling back to their own club when
// nothing is selected. For everyone else it is always their own club, so this
// override can never widen a non-admin's access.
export async function getActiveClubId(
  member: ClubScopedMember,
): Promise<string | null> {
  if (member?.is_admin) {
    const selected = await getSelectedClubId();
    if (selected) return selected;
  }
  return member?.current_club_id ?? null;
}
