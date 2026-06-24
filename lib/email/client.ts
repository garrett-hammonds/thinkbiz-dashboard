import 'server-only';
import { Resend } from 'resend';

// Lazily construct the client so a missing key during build doesn't crash the
// app — notifications are best-effort and sending is guarded by isEmailEnabled().
let cached: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Sends a single email via Resend. Never throws — returns false on any failure
// so callers (which are themselves best-effort) can carry on.
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const resend = getResend();
  const from = process.env.EMAIL_FROM;
  if (!resend || !from) {
    console.warn('[email] RESEND_API_KEY or EMAIL_FROM not set; skipping email send.');
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      console.error('[email] Resend send failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] Resend send threw:', err);
    return false;
  }
}

export interface EmailDiagnosticResult {
  ok: boolean;
  // Surfaces the reason a send didn't go out so the admin diagnostic can show
  // it (e.g. "domain is not verified", "API key is invalid"). Never throws.
  error?: string;
  from?: string;
}

// Like sendEmail but reports the failure reason instead of swallowing it. Used
// only by the admin diagnostic endpoint — not part of the normal send path.
export async function sendEmailDiagnostic(message: EmailMessage): Promise<EmailDiagnosticResult> {
  const resend = getResend();
  const from = process.env.EMAIL_FROM;
  if (!resend) return { ok: false, error: 'RESEND_API_KEY is not set on the server' };
  if (!from) return { ok: false, error: 'EMAIL_FROM is not set on the server' };

  try {
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) {
      return { ok: false, from, error: (error.message || String(error)).slice(0, 300) };
    }
    return { ok: true, from };
  } catch (err) {
    const e = err as { message?: string };
    return { ok: false, from, error: (e?.message || 'unknown error').toString().slice(0, 300) };
  }
}
