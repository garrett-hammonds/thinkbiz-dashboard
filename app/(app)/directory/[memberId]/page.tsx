import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  Globe,
  Linkedin,
  Mail,
  Phone,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getMemberForUser } from '@/utils/supabase/getMember';
import { membershipGateRedirect } from '@/utils/membership';
import { createAdminClient } from '@/utils/supabase/admin';
import { getDirectoryProfile, type DirectoryClub } from '@/utils/supabase/directory';
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
}: {
  params: Promise<{ memberId: string }>;
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
  const profile = await getDirectoryProfile(memberId);
  if (!profile) {
    notFound();
  }

  const admin = createAdminClient();
  const [{ data: clubData }, { data: starRow }] = await Promise.all([
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
  ]);

  const club = (clubData as DirectoryClub | null) ?? null;
  const isSelf = viewer.id === profile.id;
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const titleLine = [profile.title, profile.company_name].filter(Boolean).join(' · ');
  const about = profile.bio?.trim() || profile.short_bio?.trim() || null;
  const skills = (profile.core_skills || []).map((s) => s.trim()).filter(Boolean);

  const contacts: { icon: React.ReactNode; label: string; value: string; href: string }[] = [];
  if (profile.email) {
    contacts.push({
      icon: <Mail className="h-4 w-4" aria-hidden="true" />,
      label: 'Email',
      value: profile.email,
      href: `mailto:${profile.email}`,
    });
  }
  if (profile.phone_number) {
    contacts.push({
      icon: <Phone className="h-4 w-4" aria-hidden="true" />,
      label: 'Phone',
      value: profile.phone_number,
      href: `tel:${profile.phone_number.replace(/[^+\d]/g, '')}`,
    });
  }
  if (profile.website_url) {
    contacts.push({
      icon: <Globe className="h-4 w-4" aria-hidden="true" />,
      label: 'Website',
      value: profile.website_url.replace(/^https?:\/\//i, ''),
      href: toHref(profile.website_url),
    });
  }
  if (profile.linkedin_url) {
    contacts.push({
      icon: <Linkedin className="h-4 w-4" aria-hidden="true" />,
      label: 'LinkedIn',
      value: 'View profile',
      href: toHref(profile.linkedin_url),
    });
  }
  if (profile.booking_calendar_url) {
    contacts.push({
      icon: <CalendarClock className="h-4 w-4" aria-hidden="true" />,
      label: 'Book a meeting',
      value: 'Open calendar',
      href: toHref(profile.booking_calendar_url),
    });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/directory"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-secondary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to directory
      </Link>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {profile.member_headshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.member_headshot}
              alt={`${fullName} headshot`}
              className="h-28 w-28 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
              {`${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold leading-snug text-foreground">{fullName}</h1>
            {titleLine && <p className="mt-1 text-gray-500">{titleLine}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {profile.club_seat && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                  {profile.club_seat}
                </span>
              )}
              {club && (
                <span className="inline-flex items-center rounded-full bg-secondary/10 px-3 py-0.5 text-sm font-medium text-secondary">
                  {clubLabel(club)}
                  {club.area ? ` · ${club.area}` : ''}
                </span>
              )}
            </div>

            {profile.member_since && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Member since {memberSinceLabel(profile.member_since)}
              </p>
            )}

            {!isSelf && (
              <div className="mt-5">
                <ProfileActions
                  memberId={profile.id}
                  memberFirstName={profile.first_name}
                  initialStarred={!!starRow}
                />
              </div>
            )}
            {isSelf && (
              <p className="mt-5 text-sm text-gray-500">
                This is your directory profile.{' '}
                <Link href="/profile" className="font-semibold text-primary hover:text-secondary">
                  Edit it here.
                </Link>
              </p>
            )}
          </div>
        </div>

        {about && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="text-xl font-semibold leading-normal text-foreground">About</h2>
            <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-gray-900">
              {about}
            </p>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold leading-normal text-foreground">Core skills</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {contacts.length > 0 && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h2 className="text-xl font-semibold leading-normal text-foreground">Contact</h2>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {contacts.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    target={c.href.startsWith('http') ? '_blank' : undefined}
                    rel={c.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="text-primary">{c.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {c.label}
                      </span>
                      <span className="block truncate text-sm text-gray-900">{c.value}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
