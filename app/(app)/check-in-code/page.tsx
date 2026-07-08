import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { membershipGateRedirect } from '@/utils/membership';
import { createCheckinToken } from '@/utils/checkinTokens';

export const dynamic = 'force-dynamic';

// A member's personal check-in code. At the meeting, the club director scans
// this with the in-app scanner (/dashboard/attendance/scan) to log the
// member's attendance. The code is permanent — it only identifies the member;
// every scan re-verifies club membership server-side — so a screenshot or a
// printed card works just as well as the live page.
export default async function CheckInCodePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const member = await getMemberForUser(supabase, user);

  if (!member) {
    redirect('/access-denied');
  }

  if (!member.profile_completed_at) {
    redirect('/onboarding');
  }

  const gate = membershipGateRedirect(member);
  if (gate) {
    redirect(gate);
  }

  const name =
    `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim() || member.email;

  const token = await createCheckinToken(member.id);

  // Crisp inline SVG so the code renders sharp at any size, matching the
  // visitor QR page.
  const qrSvg = await QRCode.toString(token, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            My check-in code
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-snug text-foreground">
            {name}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-gray-500">
            Show this to your club director as you arrive and they&apos;ll scan
            you in.
          </p>

          <div
            className="mx-auto my-8 w-full max-w-xs"
            // qrcode returns a trusted, self-generated SVG string.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <p className="text-sm text-muted-foreground">
            This code never changes — feel free to screenshot it for faster
            check-ins.
          </p>
        </div>
      </main>
  );
}
