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
function layout(opts: { heading: string; paragraphs: string[]; ctaLabel: string; ctaUrl: string }): string {
  const body = opts.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333;">${p}</p>`)
    .join('');
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
        <p style="margin:28px 0 0;font-size:12px;color:#94a3b8;">You're receiving this because notifications are enabled on your ${BRAND} account. You can change this anytime in your profile settings.</p>
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
