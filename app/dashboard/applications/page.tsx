import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import ApproveButton from './ApproveButton';
import { DenyButton } from './DenyButton';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getSelectedClubId } from '@/utils/activeClub';

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const memberData = await getMemberForUser(supabase, user);

  if (!memberData || (!memberData.is_admin && !memberData.club_director)) {
    redirect('/access-denied');
  }

  if (!memberData.profile_completed_at) {
    redirect('/onboarding');
  }

  // Admins review every club's applications by default. When an admin picks a
  // specific club in the switcher, scope to that club so the queue matches the
  // rest of their view. Directors are always limited to their own club — and a
  // director with no club assignment sees nothing (never the whole network).
  const isAdmin = !!memberData.is_admin;
  const scopeClubId = isAdmin
    ? await getSelectedClubId()
    : memberData.current_club_id ?? null;

  let query = supabase
    .from('pending_applications')
    .select('*, clubs(name)')
    .eq('status', 'pending');
  if (scopeClubId) {
    query = query.eq('club_id', scopeClubId);
  }
  // Only run the query when there's something in scope: an admin (all clubs or a
  // selected one) or a director with a club. A director without a club gets an
  // empty queue rather than the whole network.
  const applications = isAdmin || scopeClubId ? (await query).data : null;

  // Surface the active scope so an admin knows whether they're seeing one club
  // or the whole network.
  let scopeLabel = isAdmin ? 'Across all clubs' : 'No club assigned';
  if (scopeClubId) {
    const { data: scopeClub } = await supabase
      .from('clubs')
      .select('name, display_name')
      .eq('id', scopeClubId)
      .maybeSingle();
    const name = scopeClub?.display_name || scopeClub?.name;
    scopeLabel = name ? `For ${name}` : 'For the selected club';
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="mb-1 text-4xl font-black leading-tight tracking-tight text-foreground">Pending Applications</h1>
        <p className="mb-8 text-sm font-medium text-muted-foreground">{scopeLabel}</p>

        {!applications || applications.length === 0 ? (
          <p className="text-muted-foreground">No pending applications</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {applications.map((app) => (
              <div 
                key={app.id} 
                className="bg-white rounded-xl border border-gray-100 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-[2px] flex flex-col gap-4 p-6"
              >
                <div>
                  <h2 className="text-2xl font-bold leading-snug text-foreground">{app.first_name} {app.last_name}</h2>
                  <p className="text-gray-500 text-sm font-medium">{app.email} {app.phone ? `• ${app.phone}` : ''}</p>
                </div>
                
                <div>
                  <p className="text-gray-500 text-sm font-medium">Company</p>
                  <p className="text-gray-900 text-base">{app.company_name} - {app.title}</p>
                </div>
                
                <div>
                  <p className="text-gray-500 text-sm font-medium">Requested Club</p>
                  <p className="text-gray-900 text-base">{app.clubs?.name || 'N/A'}</p>
                </div>
                
                {app.bio && (
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Bio</p>
                    <p className="text-gray-900 text-base line-clamp-3">{app.bio}</p>
                  </div>
                )}
                
                <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
                  <ApproveButton applicationId={app.id} />
                  <DenyButton applicationId={app.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
