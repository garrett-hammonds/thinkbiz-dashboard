import { createClient } from '@supabase/supabase-js';
import { VisitorCheckInForm } from './VisitorCheckInForm';

export const dynamic = 'force-dynamic';

function VisitShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-100 shadow-card p-8 transition-all duration-200">
        {children}
      </div>
    </main>
  );
}

export default async function VisitPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;

  // Public page: look up the club name with the anon client so we can greet
  // the visitor and confirm the QR code points at a real club.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: club } = await supabase
    .from('clubs')
    .select('name, display_name')
    .eq('id', clubId)
    .maybeSingle();

  if (!club) {
    return (
      <VisitShell>
        <h1 className="text-3xl font-bold leading-snug text-foreground text-center mb-4">
          Check-in link not found
        </h1>
        <p className="text-base leading-relaxed text-gray-900 text-center">
          This check-in link doesn&apos;t match a ThinkBiz club. Please ask the
          meeting host for an up-to-date link or QR code.
        </p>
      </VisitShell>
    );
  }

  const clubName = club.display_name || club.name || 'this ThinkBiz club';

  return (
    <VisitShell>
      <VisitorCheckInForm clubId={clubId} clubName={clubName} />
    </VisitShell>
  );
}
