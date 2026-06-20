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
          <a href="${encodeURI(opts.ctaUrl)}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">${escapeHtml(opts.ctaLabel)}</a>
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
        `You can now sign in, complete your profile, and start connecting with your club.`,
      ],
      ctaLabel: 'Go to your dashboard',
      ctaUrl: opts.url,
    }),
    text: `Welcome to ${BRAND}! Your application has been approved. Sign in to get started: ${opts.url}`,
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
