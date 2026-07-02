'use server';

import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/client';
import { visitorWelcomeEmail } from '@/lib/email/templates';
import { firstLengthError } from '@/utils/validation';
import { verifyCaptcha } from '@/lib/captcha';
import { checkRateLimit } from '@/lib/rateLimit';
import { clientIp } from '@/utils/requestIp';

export interface VisitorFormData {
  clubId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  title: string;
  notes: string;
}

// Formspree endpoint for the check-in form. Overridable via env so the
// endpoint can change without a code deploy; falls back to the live form.
const FORMSPREE_ENDPOINT =
  process.env.FORMSPREE_VISITOR_ENDPOINT || 'https://formspree.io/f/mgojolqz';

// Best-effort copy of the submission to Formspree (gives the club an email
// trail + the Formspree dashboard). Never let a Formspree failure fail the
// check-in — Supabase is the source of truth the app reads from, and
// Formspree's free tier is rate-limited. Mirrors the best-effort director
// notification in app/apply/submitApplication.ts.
async function forwardToFormspree(
  formData: VisitorFormData,
  clubName: string | null,
): Promise<void> {
  if (!FORMSPREE_ENDPOINT) return;

  await fetch(FORMSPREE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      // `_subject` and `email` are special fields Formspree understands:
      // they set the notification subject and reply-to address.
      _subject: `New visitor check-in${clubName ? ` — ${clubName}` : ''}`,
      email: formData.email.trim() || undefined,
      club: clubName || formData.clubId,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      company: formData.companyName.trim() || undefined,
      title: formData.title.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    }),
  });
}

export async function submitVisitorAction(formData: VisitorFormData, captchaToken?: string) {
  if (!formData || !formData.clubId || !formData.firstName.trim()) {
    return { success: false, message: 'Please enter your name.' };
  }

  // Abuse protection for this public, unauthenticated endpoint: a human check
  // then per-IP and per-email throttling. Both no-op gracefully when their
  // backing services aren't configured (see lib/captcha, lib/rateLimit).
  const ip = clientIp(await headers());

  if (!(await verifyCaptcha(captchaToken, ip))) {
    return { success: false, message: 'Please complete the verification challenge and try again.' };
  }

  const tooBusy = { success: false, message: 'Too many submissions. Please wait a little and try again.' };
  if (!(await checkRateLimit(`visitor:ip:${ip}`, 5, '10 m')).ok) return tooBusy;

  // A visitor must leave at least one way to be contacted, matching the
  // table's CHECK constraint.
  if (!formData.email.trim() && !formData.phone.trim()) {
    return { success: false, message: 'Please add an email or phone number so the club can reach you.' };
  }

  const trimmedEmail = formData.email.trim().toLowerCase();
  if (trimmedEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    // Cap check-ins targeting a single email address, so the welcome email
    // below can't be used to bomb one victim from many IPs.
    if (!(await checkRateLimit(`visitor:email:${trimmedEmail}`, 3, '1 h')).ok) return tooBusy;
  }

  const lengthError = firstLengthError([
    ['First name', formData.firstName, 'name'],
    ['Last name', formData.lastName, 'name'],
    ['Email', formData.email, 'email'],
    ['Phone', formData.phone, 'phone'],
    ['Company name', formData.companyName, 'shortText'],
    ['Title', formData.title, 'shortText'],
    ['Notes', formData.notes, 'longText'],
  ]);
  if (lengthError) {
    return { success: false, message: lengthError };
  }

  // Anon client: the check-in form is public (no login), and the visitors
  // INSERT policy allows the anon role. Mirrors app/apply/submitApplication.ts.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { error } = await supabase.from('visitors').insert([
    {
      club_id: formData.clubId,
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      company_name: formData.companyName.trim() || null,
      title: formData.title.trim() || null,
      notes: formData.notes.trim() || null,
      source: 'meeting',
    },
  ]);

  if (error) {
    // 23503 = foreign key violation: the club id in the URL doesn't exist.
    if (error.code === '23503') {
      return { success: false, message: "We couldn't find that club. Please ask the host for an up-to-date check-in link." };
    }
    console.error('Error inserting visitor:', error);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }

  // Best-effort follow-ups. The Supabase row above is the record of truth, so
  // neither of these may ever block a successful check-in.
  //   1. Forward the entry to Formspree (gives the club an email/dashboard copy).
  //   2. Email the visitor a membership intro + invite back to a future meeting.
  // The club name is shared by both, so we fetch it once.
  try {
    const { data: club } = await supabase
      .from('clubs')
      .select('name, display_name')
      .eq('id', formData.clubId)
      .maybeSingle();
    const clubName = club?.display_name || club?.name || null;

    await forwardToFormspree(formData, clubName);

    // Only when the visitor left an email. sendEmail() is itself a no-op when
    // RESEND_API_KEY / EMAIL_FROM aren't configured, so this is safe either way.
    const visitorEmail = formData.email.trim();
    if (visitorEmail) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const welcome = visitorWelcomeEmail({
        firstName: formData.firstName.trim() || undefined,
        clubName: clubName || undefined,
        applyUrl: `${siteUrl}/apply`,
      });
      await sendEmail({ to: visitorEmail, ...welcome });
    }
  } catch (followUpError) {
    console.error('[submitVisitor] visitor follow-up failed:', followUpError);
  }

  return { success: true };
}
