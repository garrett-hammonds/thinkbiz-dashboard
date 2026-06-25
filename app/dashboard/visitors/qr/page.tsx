import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import QRCode from 'qrcode';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { getActiveClubId } from '@/utils/activeClub';
import { Navbar } from '@/components/navbar';
import { QrActions } from './QrActions';

export const dynamic = 'force-dynamic';

export default async function VisitorQrPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  // Only directors/admins generate the QR code shown on meeting slides.
  if (!member || (!member.is_admin && !member.club_director)) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  // Directors generate the QR for their own club; admins for whichever club
  // they've selected in the switcher.
  const activeClubId = await getActiveClubId(member);

  if (!activeClubId) {
    redirect('/dashboard/visitors');
  }

  const { data: club } = await supabase
    .from('clubs')
    .select('name, display_name')
    .eq('id', activeClubId)
    .maybeSingle();

  const clubName = club?.display_name || club?.name || 'your club';

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const checkInUrl = `${baseUrl}/visit/${activeClubId}`;

  // Render the QR as crisp inline SVG (prints at any size, no network calls).
  const qrSvg = await QRCode.toString(checkInUrl, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="print:hidden mb-6">
          <Link
            href="/dashboard/visitors"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to visitors
          </Link>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Scan to check in
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-snug text-foreground">
            Welcome to {clubName}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-gray-500">
            New here? Scan this code with your phone camera to share your details.
          </p>

          <div
            className="mx-auto my-8 w-full max-w-xs"
            // qrcode returns a trusted, self-generated SVG string.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          {baseUrl ? (
            <a
              href={checkInUrl}
              className="break-all text-sm font-medium text-primary transition-colors hover:text-secondary"
            >
              {checkInUrl}
            </a>
          ) : (
            <p className="text-sm text-red-600">
              Set NEXT_PUBLIC_SITE_URL so the QR code points at your live site.
            </p>
          )}
        </div>

        <div className="print:hidden mt-6 flex justify-center">
          <QrActions svg={qrSvg} clubName={clubName} />
        </div>
      </main>
    </div>
  );
}
