import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { membershipGateRedirect } from '@/utils/membership';
import {
  getDirectoryClubs,
  getMemberDirectory,
  getStarredMemberIds,
} from '@/utils/supabase/directory';
import { DirectoryClient } from '@/components/directory/DirectoryClient';

export const dynamic = 'force-dynamic';

export default async function DirectoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  if (!member || !member.is_active) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  const gate = membershipGateRedirect(member);
  if (gate) {
    redirect(gate);
  }

  const [members, clubs, starredIds] = await Promise.all([
    getMemberDirectory(),
    getDirectoryClubs(),
    getStarredMemberIds(member.id),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground">
          Member Directory
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find fellow members across every club — search by name, filter by
          area or profession, and star the people you want to keep close.
        </p>
      </div>

      <DirectoryClient
        members={members}
        clubs={clubs}
        viewerId={member.id}
        viewerClubId={member.current_club_id ?? null}
        initialStarredIds={starredIds}
      />
    </main>
  );
}
