import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyDirectorInviteToken } from '@/utils/inviteTokens';
import DirectorInviteForm from '@/components/DirectorInviteForm';

export default async function DirectorInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <InviteError message="No invite token provided." />;
  }

  let claims;
  try {
    claims = await verifyDirectorInviteToken(token);
  } catch (err) {
    console.warn('[director-invite] token verification failed:', err);
    return <InviteError message="This invite link is invalid or has expired." />;
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: club } = await admin
    .from('clubs')
    .select('id, name')
    .eq('id', claims.clubId)
    .maybeSingle();

  if (!club) {
    return <InviteError message="The club referenced by this invite no longer exists." />;
  }

  const { data: existingMember } = await admin
    .from('members')
    .select('id, auth_user_id')
    .ilike('email', claims.email)
    .maybeSingle();

  if (existingMember?.auth_user_id) {
    return (
      <InviteError message="An account already exists for this email. Use the login page or contact ThinkBiz Support." />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold leading-snug text-foreground mb-2">
          You&apos;ve been invited as a Director
        </h1>
        <p className="text-gray-500 mb-8">
          You&apos;re being set up as Club Director for <strong>{club.name}</strong>.
        </p>
        <DirectorInviteForm token={token} email={claims.email} clubName={club.name} />
      </main>
    </div>
  );
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">Invite unavailable</h1>
        <p className="text-gray-600">{message}</p>
      </main>
    </div>
  );
}
