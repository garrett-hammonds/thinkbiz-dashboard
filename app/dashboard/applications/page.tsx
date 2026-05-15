import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import ApproveButton from './ApproveButton';
import { getMemberForUser } from '@/utils/supabase/getMember';

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

  let query = supabase.from('pending_applications').select('*, clubs(name)').eq('status', 'pending');

  if (!memberData.is_admin) {
    query = query.eq('club_id', memberData.current_club_id);
  }

  const { data: applications } = await query;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="mb-8 text-4xl font-black leading-tight tracking-tight text-foreground">Pending Applications</h1>
        
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
                
                <div className="mt-auto pt-4 border-t border-gray-100">
                  <ApproveButton applicationId={app.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
