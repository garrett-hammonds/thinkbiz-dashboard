// Notification email templates.
//
// Plain template-literal HTML keeps v1 dependency-free and matches the codebase's
// no-extra-frameworks style. Each function returns { subject, html, text } ready to
// hand to sendEmail(). Switch to @react-email/components later if richer templates
// are wanted.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = 'ThinkBiz Solutions';
const PRIMARY = '#1a73e8';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shared shell: heading, body paragraphs, and a call-to-action button.
// `footer` overrides the default account-settings footnote — used by emails to
// non-members (e.g. visitors), for whom "notifications on your account" is wrong.
function layout(opts: { heading: string; paragraphs: string[]; ctaLabel: string; ctaUrl: string; footer?: string }): string {
  const body = opts.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333;">${p}</p>`)
    .join('');
  const footer = opts.footer
    ?? `You're receiving this because notifications are enabled on your ${BRAND} account. You can change this anytime in your profile settings.`;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 20px;font-size:20px;color:#0f172a;">${escapeHtml(opts.heading)}</h1>
        ${body}
        <p style="margin:24px 0 0;">
          <!-- escapeHtml (not encodeURI): ctaUrl is already a fully-formed,
               percent-encoded URL from URLSearchParams. encodeURI would re-escape
               its '%' characters (e.g. next=%2F... → next=%252F...), corrupting
               query params — that double-encoding once sent password-reset links
               to /dashboard instead of /update-password. escapeHtml only makes the
               URL safe inside the href attribute and leaves the encoding intact. -->
          <a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">${escapeHtml(opts.ctaLabel)}</a>
        </p>
        <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;">${escapeHtml(footer)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function applicationApprovedEmail(opts: { firstName?: string; url: string }): RenderedEmail {
  const name = opts.firstName ? `, ${opts.firstName}` : '';
  return {
    subject: `You're approved — welcome to ${BRAND}`,
    html: layout({
      heading: `Welcome to ${BRAND}!`,
      paragraphs: [
        `Great news${escapeHtml(name)} — your application has been approved.`,
        `Click below to set your password and finish setting up your account. The button signs you in, then walks you through choosing a password and completing your profile.`,
      ],
      ctaLabel: 'Set your password & get started',
      ctaUrl: opts.url,
    }),
    text: `Welcome to ${BRAND}! Your application has been approved. Set your password and finish setting up your account here: ${opts.url}`,
  };
}

export function passwordResetEmail(opts: { firstName?: string; url: string }): RenderedEmail {
  const name = opts.firstName ? `, ${opts.firstName}` : '';
  return {
    subject: `Reset your ${BRAND} password`,
    html: layout({
      heading: 'Reset your password',
      paragraphs: [
        `Hi${escapeHtml(name)} — we got a request to reset your ${BRAND} password.`,
        `Click below to choose a new password and sign back in. If you didn't request this, you can safely ignore this email.`,
      ],
      ctaLabel: 'Reset your password',
      ctaUrl: opts.url,
    }),
    text: `Reset your ${BRAND} password here: ${opts.url}\n\nIf you didn't request this, you can ignore this email.`,
  };
}

export function memberInviteEmail(opts: { firstName?: string; url: string }): RenderedEmail {
  const name = opts.firstName ? `, ${opts.firstName}` : '';
  return {
    subject: `Your invitation to ${BRAND}`,
    html: layout({
      heading: `You're invited to ${BRAND}`,
      paragraphs: [
        `Hi${escapeHtml(name)} — your club director invited you to join ${BRAND}.`,
        `Click below to set up your account, complete your profile, and start connecting with your club. This link will sign you in.`,
      ],
      ctaLabel: 'Accept your invitation',
      ctaUrl: opts.url,
    }),
    text: `You're invited to ${BRAND}! Accept your invitation and set up your account here: ${opts.url}`,
  };
}

export function newApplicationEmail(opts: { applicantName: string; clubName?: string; url: string }): RenderedEmail {
  const club = opts.clubName ? ` to ${escapeHtml(opts.clubName)}` : '';
  return {
    subject: `New ThinkBiz application: ${opts.applicantName}`,
    html: layout({
      heading: 'New membership application',
      paragraphs: [
        `<strong>${escapeHtml(opts.applicantName)}</strong> just applied to join${club}.`,
        `Review their details and approve or deny the application.`,
      ],
      ctaLabel: 'Review application',
      ctaUrl: opts.url,
    }),
    text: `${opts.applicantName} just applied to join${opts.clubName ? ` ${opts.clubName}` : ''}. Review it here: ${opts.url}`,
  };
}

export function weeklyLogReminderEmail(opts: { firstName?: string; url: string }): RenderedEmail {
  const name = opts.firstName ? ` ${opts.firstName}` : '';
  return {
    subject: 'Reminder: submit your weekly log',
    html: layout({
      heading: 'Your weekly log is due',
      paragraphs: [
        `Hi${escapeHtml(name)}, this is a friendly reminder to submit your weekly activity log.`,
        `It only takes a minute and keeps your club's numbers up to date.`,
      ],
      ctaLabel: 'Submit your log',
      ctaUrl: opts.url,
    }),
    text: `Reminder: submit your weekly activity log here: ${opts.url}`,
  };
}

export function chatMentionEmail(opts: {
  authorName: string;
  channelName: string;
  snippet: string;
  url: string;
}): RenderedEmail {
  return {
    subject: `${opts.authorName} mentioned you in #${opts.channelName}`,
    html: layout({
      heading: `${escapeHtml(opts.authorName)} mentioned you`,
      paragraphs: [
        `In <strong>#${escapeHtml(opts.channelName)}</strong>:`,
        `<span style="color:#475569;">${escapeHtml(opts.snippet)}</span>`,
      ],
      ctaLabel: 'Open chat',
      ctaUrl: opts.url,
    }),
    text: `${opts.authorName} mentioned you in #${opts.channelName}: ${opts.snippet}\n\nOpen chat: ${opts.url}`,
  };
}

// Sent to club directors and admins when a member reports a chat message.
// Always sent (not subject to notification preferences): acting on reports
// within 24 hours is part of the App Store user-generated-content rules.
export function chatReportEmail(opts: {
  reportedName: string;
  reason: string;
  where: string;
  snippet: string;
  url: string;
}): RenderedEmail {
  return {
    subject: `Chat report: ${opts.reportedName} (${opts.reason})`,
    html: layout({
      heading: 'A chat message was reported',
      paragraphs: [
        `A member reported a message from <strong>${escapeHtml(opts.reportedName)}</strong> in ${escapeHtml(opts.where)} for <strong>${escapeHtml(opts.reason)}</strong>.`,
        opts.snippet ? `<span style="color:#475569;">${escapeHtml(opts.snippet)}</span>` : '',
        `Please review it within 24 hours: remove the message, suspend the member from chat, or dismiss the report.`,
      ].filter(Boolean),
      ctaLabel: 'Review report',
      ctaUrl: opts.url,
      footer: `You're receiving this because you moderate chat as a ${BRAND} director or admin.`,
    }),
    text: `A member reported a message from ${opts.reportedName} in ${opts.where} for ${opts.reason}.\n\n${opts.snippet}\n\nReview it within 24 hours: ${opts.url}`,
  };
}

// Sent to the blocked member's club directors and all admins when a member
// blocks someone in chat (App Store Guideline 1.2: blocking notifies the
// developer). Never sent to the blocked member.
export function chatBlockEmail(opts: {
  blockerName: string;
  blockedName: string;
  at: Date;
  profileUrl: string;
  reportsUrl: string;
}): RenderedEmail {
  const when = opts.at.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
  return {
    subject: `Chat block: ${opts.blockerName} blocked ${opts.blockedName}`,
    html: layout({
      heading: 'A member was blocked in chat',
      paragraphs: [
        `<strong>${escapeHtml(opts.blockerName)}</strong> blocked <strong>${escapeHtml(opts.blockedName)}</strong> on ${escapeHtml(when)}. ${escapeHtml(opts.blockedName)}'s messages are now hidden from ${escapeHtml(opts.blockerName)} and neither can direct message the other.`,
        `Blocking can signal abusive behaviour. Check for related reports at <a href="${escapeHtml(opts.reportsUrl)}" style="color:${PRIMARY};">Chat Reports</a>, and suspend the member from chat from their profile if needed.`,
      ],
      ctaLabel: `View ${opts.blockedName}'s profile`,
      ctaUrl: opts.profileUrl,
      footer: `You're receiving this because you moderate chat as a ${BRAND} director or admin.`,
    }),
    text: `${opts.blockerName} blocked ${opts.blockedName} on ${when}.\n\nProfile: ${opts.profileUrl}\nChat reports: ${opts.reportsUrl}`,
  };
}

// Sent to a visitor right after they check in / pre-register. Introduces
// membership + its benefits and invites them back to a future meeting. The CTA
// points at the public application page. Non-transactional and best-effort:
// callers must never let a failure block the check-in (see submitVisitor.ts).
export function visitorWelcomeEmail(opts: { firstName?: string; clubName?: string; applyUrl: string }): RenderedEmail {
  const name = opts.firstName ? `, ${opts.firstName}` : '';
  const club = opts.clubName ? escapeHtml(opts.clubName) : 'our club';
  return {
    subject: `Thanks for visiting ${BRAND}`,
    html: layout({
      heading: 'Thanks for visiting!',
      paragraphs: [
        `It was great having you${escapeHtml(name)} at ${club}. We'd love to see you again at a future meeting.`,
        `<strong>${BRAND}</strong> is a community of business owners who help each other grow through trusted referrals, weekly accountability, and a supportive network. As a member you get:`,
        `&bull; A dedicated seat in your club's referral network<br/>` +
          `&bull; Weekly meetings to build relationships and pass business<br/>` +
          `&bull; Member directory, group chat, and your activity dashboard<br/>` +
          `&bull; The accountability and connections to grow your business`,
        `If that sounds like a fit, you can apply for membership below — and either way, come join us at the next meeting.`,
      ],
      ctaLabel: 'Learn about membership',
      ctaUrl: opts.applyUrl,
      footer: `You're receiving this because you checked in as a visitor at ${club}. No account is created from this email.`,
    }),
    text:
      `It was great having you${name} at ${opts.clubName || 'our club'}. We'd love to see you again at a future meeting.\n\n` +
      `${BRAND} is a community of business owners who help each other grow through trusted referrals, weekly accountability, and a supportive network. As a member you get a seat in your club's referral network, weekly meetings, the member directory and chat, and your activity dashboard.\n\n` +
      `Learn about membership and apply here: ${opts.applyUrl}\n\n` +
      `Either way, come join us at the next meeting!`,
  };
}
