import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Armchair,
  Building2,
  Calendar,
  CalendarClock,
  Globe,
  Info,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { membershipGateRedirect } from '@/utils/membership';
import { createAdminClient } from '@/utils/supabase/admin';
import { getDirectoryProfile, type DirectoryClub } from '@/utils/supabase/directory';
import { canModerateMember } from '@/lib/chat/safety';
import { ProfileActions } from '@/components/directory/ProfileActions';

export const dynamic = 'force-dynamic';

function clubLabel(club: DirectoryClub | null): string {
  if (!club) return '';
  return club.display_name || club.name || '';
}

// Normalizes stored URLs for use in href (members paste bare domains).
function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function memberSinceLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default async function DirectoryProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const viewer = await getMemberForUser(supabase, user);

  if (!viewer || !viewer.is_active) {
    redirect('/access-denied');
  }

  if (!viewer.profile_completed_at) {
    redirect('/onboarding');
  }

  const gate = membershipGateRedirect(viewer);
  if (gate) {
    redirect(gate);
  }

  const { memberId } = await params;
  const { from } = await searchParams;
  // Directors arrive from the roster; send them back there.
  const back =
    from === 'roster' && (viewer.is_admin || viewer.club_director)
      ? { href: '/dashboard/roster', label: 'Back to roster' }
      : { href: '/directory', label: 'Back to directory' };
  const profile = await getDirectoryProfile(memberId);
  if (!profile) {
    notFound();
  }

  const admin = createAdminClient();
  const [
    { data: clubData },
    { data: starRow },
    { data: blockRows },
    { data: targetRoles },
    { data: suspension },
  ] = await Promise.all([
    profile.current_club_id
      ? admin
          .from('clubs')
          .select('id, name, display_name, area, city')
          .eq('id', profile.current_club_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('member_stars')
      .select('starred_member_id')
      .eq('member_id', viewer.id)
      .eq('starred_member_id', profile.id)
      .maybeSingle(),
    // DM blocks between the two of us, either direction.
    admin
      .from('member_dm_blocks')
      .select('blocker_id')
      .or(
        `and(blocker_id.eq.${viewer.id},blocked_id.eq.${profile.id}),and(blocker_id.eq.${profile.id},blocked_id.eq.${viewer.id})`,
      ),
    admin
      .from('members')
      .select('id, current_club_id, is_admin, club_director')
      .eq('id', profile.id)
      .maybeSingle(),
    admin.from('chat_suspensions').select('member_id').eq('member_id', profile.id).maybeSingle(),
  ]);

  const blockedByMe = (blockRows ?? []).some((b) => b.blocker_id === viewer.id);
  const blockedMe = (blockRows ?? []).some((b) => b.blocker_id === profile.id);
  const canSuspend = !!targetRoles && canModerateMember(viewer, targetRoles);

  const club = (clubData as DirectoryClub | null) ?? null;
  const isSelf = viewer.id === profile.id;
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const titleLine = [profile.title, profile.company_name].filter(Boolean).join(' · ');
  const about = profile.bio?.trim() || profile.short_bio?.trim() || null;
  const skills = (profile.core_skills || []).map((s) => s.trim()).filter(Boolean);

  const contacts: { icon: React.ReactNode; label: string; value: string; href: string }[] = [];
  if (profile.email) {
    contacts.push({
      icon: <Mail className="h-5 w-5" aria-hidden="true" />,
      label: 'Email',
      value: profile.email,
      href: `mailto:${profile.email}`,
    });
  }
  if (profile.phone_number) {
    contacts.push({
      icon: <Phone className="h-5 w-5" aria-hidden="true" />,
      label: 'Phone',
      value: profile.phone_number,
      href: `tel:${profile.phone_number.replace(/[^+\d]/g, '')}`,
    });
  }
  if (profile.website_url) {
    contacts.push({
      icon: <Globe className="h-5 w-5" aria-hidden="true" />,
      label: 'Website',
      value: profile.website_url.replace(/^https?:\/\//i, ''),
      href: toHref(profile.website_url),
    });
  }
  if (profile.linkedin_url) {
    contacts.push({
      icon: <Linkedin className="h-5 w-5" aria-hidden="true" />,
      label: 'LinkedIn',
      value: 'View profile',
      href: toHref(profile.linkedin_url),
    });
  }
  if (profile.booking_calendar_url) {
    contacts.push({
      icon: <CalendarClock className="h-5 w-5" aria-hidden="true" />,
      label: 'Book a meeting',
      value: 'Open calendar',
      href: toHref(profile.booking_calendar_url),
    });
  }

  const hasDetails =
    !!about || skills.length > 0 || !!profile.club_seat || !!club || !!profile.member_since;

  // Laid out like a messaging app's contact page: a centered header with
  // quick actions, then stacked sections of icon rows, with block and
  // moderation rows at the bottom.
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href={back.href}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-secondary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {back.label}
      </Link>

      <ProfileActions
        memberId={profile.id}
        memberFirstName={profile.first_name}
        email={profile.email}
        phone={profile.phone_number}
        isSelf={isSelf}
        initialStarred={!!starRow}
        initialBlocked={blockedByMe}
        blockedMe={blockedMe}
        canSuspend={canSuspend}
        initialSuspended={!!suspension}
        header={
          <div className="flex flex-col items-center text-center">
            {profile.member_headshot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.member_headshot}
                alt={`${fullName} headshot`}
                className="h-36 w-36 rounded-full object-cover ring-4 ring-white shadow-card"
              />
            ) : (
              <span className="flex h-36 w-36 items-center justify-center rounded-full bg-primary/10 text-4xl font-bold text-primary ring-4 ring-white shadow-card">
                {`${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()}
              </span>
            )}
            <h1 className="mt-4 text-3xl font-bold leading-snug text-foreground">{fullName}</h1>
            {titleLine && <p className="mt-1 text-lg text-gray-500">{titleLine}</p>}
          </div>
        }
      >
        {hasDetails && (
          <section className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
            {about && (
              <InfoRow icon={<Info className="h-5 w-5" aria-hidden="true" />} label="About">
                <p className="whitespace-pre-line leading-relaxed">{about}</p>
              </InfoRow>
            )}
            {profile.club_seat && (
              <InfoRow icon={<Armchair className="h-5 w-5" aria-hidden="true" />} label="Industry seat">
                {profile.club_seat}
              </InfoRow>
            )}
            {profile.company_name && (
              <InfoRow icon={<Building2 className="h-5 w-5" aria-hidden="true" />} label="Company">
                {profile.company_name}
              </InfoRow>
            )}
            {club && (
              <InfoRow icon={<MapPin className="h-5 w-5" aria-hidden="true" />} label="Club">
                {clubLabel(club)}
                {club.area ? ` · ${club.area}` : ''}
              </InfoRow>
            )}
            {profile.member_since && (
              <InfoRow icon={<Calendar className="h-5 w-5" aria-hidden="true" />} label="Member since">
                {memberSinceLabel(profile.member_since)}
              </InfoRow>
            )}
            {skills.length > 0 && (
              <InfoRow icon={<Sparkles className="h-5 w-5" aria-hidden="true" />} label="Core skills">
                <div className="mt-1 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </InfoRow>
            )}
          </section>
        )}

        {contacts.length > 0 && (
          <section className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-card">
            {contacts.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith('http') ? '_blank' : undefined}
                rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-5 border-t border-gray-100 px-5 py-4 transition-colors first:border-t-0 hover:bg-primary/5"
              >
                <span className="shrink-0 text-gray-500">{c.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-base text-primary">{c.value}</span>
                  <span className="block text-sm text-gray-500">{c.label}</span>
                </span>
              </a>
            ))}
          </section>
        )}
      </ProfileActions>
    </main>
  );
}

// One icon + content row in a profile section, with a small label underneath.
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-5 border-t border-gray-100 px-5 py-4 first:border-t-0">
      <span className="mt-0.5 shrink-0 text-gray-500">{icon}</span>
      <div className="min-w-0 flex-1 text-base text-gray-900">
        {children}
        <div className="mt-0.5 text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}
