import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import ApproveButton from './ApproveButton';

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: memberData } = await supabase
    .from('members')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

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
        <h1 className="text-3xl font-bold mb-8 text-foreground">Pending Applications</h1>
        
        {!applications || applications.length === 0 ? (
          <p className="text-muted-foreground">No pending applications</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {applications.map((app) => (
              <div 
                key={app.id} 
                className="border-4 border-black rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card p-6 flex flex-col gap-4"
              >
                <div>
                  <h2 className="text-xl font-bold text-card-foreground">{app.first_name} {app.last_name}</h2>
                  <p className="text-muted-foreground">{app.email} {app.phone ? `• ${app.phone}` : ''}</p>
                </div>
                
                <div>
                  <p className="font-semibold text-card-foreground">Company</p>
                  <p className="text-card-foreground">{app.company_name} - {app.title}</p>
                </div>
                
                <div>
                  <p className="font-semibold text-card-foreground">Requested Club</p>
                  <p className="text-card-foreground">{app.clubs?.name || 'N/A'}</p>
                </div>
                
                {app.bio && (
                  <div>
                    <p className="font-semibold text-card-foreground">Bio</p>
                    <p className="text-card-foreground line-clamp-3">{app.bio}</p>
                  </div>
                )}
                
                <div className="mt-auto pt-4 border-t-2 border-black">
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
