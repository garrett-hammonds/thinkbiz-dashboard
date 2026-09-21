import type { Metadata } from 'next';
import DocPage from '@/components/legal/DocPage';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Privacy Policy — ThinkBiz',
  description:
    'What the ThinkBiz Solutions member app collects, why, who processes it, and how a member removes their data.',
  robots: { index: true, follow: true },
};

// The privacy policy the App Store and Google Play listings point to. Every
// data type named here maps to a real table, bucket, or token in this
// codebase; keep it in step when a feature adds or removes one.
export default function PrivacyPage() {
  return (
    <DocPage
      title="Privacy Policy"
      intro="ThinkBiz is the web and mobile app for members of ThinkBiz Solutions professional networking clubs. This page explains what the app stores about you, who processes it, and how to remove it."
      updated="September 21, 2026"
    >
      <section>
        <h2>Who runs this app</h2>
        <p>
          ThinkBiz Solutions operates the app and is responsible for the data described here.
          Questions go to <a href="mailto:team@thinkbiz.solutions">team@thinkbiz.solutions</a> or
          +1 (405) 367-9874.
        </p>
      </section>

      <section>
        <h2>What the app stores</h2>
        <ul>
          <li>
            <strong>Your application and profile.</strong> Name, email, phone number, company,
            title, bio, core skills, website and LinkedIn links, a booking calendar link, and the
            headshot you upload. You provide these when you apply to a club and on your profile
            page. Your profile is visible to other members of your club in the directory.
          </li>
          <li>
            <strong>Sign-in credentials.</strong> Your email and a password, handled by Supabase
            Auth. The app never sees or stores your password in plain text.
          </li>
          <li>
            <strong>Club activity.</strong> The weekly success metrics you log, your meeting
            attendance (recorded when a director scans your check-in code), and the visitors you
            bring. Directors and admins of your club see attendance and activity summaries.
          </li>
          <li>
            <strong>Chat.</strong> Messages and images you post in club channels and direct
            messages, visible to the other members of that channel or conversation.
          </li>
          <li>
            <strong>Billing.</strong> If your club uses paid membership, your card details go
            directly to Stripe. The app stores only your Stripe customer id, subscription status,
            and renewal date.
          </li>
          <li>
            <strong>Notification tokens.</strong> A browser push subscription or a phone push
            token when you turn notifications on, plus the notification preferences you set.
            Turning notifications off deletes the token.
          </li>
          <li>
            <strong>Camera, on request only.</strong> Club directors can use the camera to scan
            check-in QR codes at meetings. Frames are read on the device to find the code and are
            never uploaded or stored.
          </li>
        </ul>
        <p>
          The app does not collect your location, contacts, advertising identifiers, or usage
          analytics, and it does not show ads.
        </p>
      </section>

      <section>
        <h2>Who processes it</h2>
        <p>
          Data lives in a Supabase database and storage bucket and is served by Vercel. Resend
          delivers account emails and reminders. Stripe processes membership payments. Apple,
          Google, and Firebase Cloud Messaging deliver push notifications to the mobile apps.
          Cloudflare Turnstile protects the public application form from bots. None of these
          providers use your data for their own purposes, and no data is sold or shared for
          advertising.
        </p>
      </section>

      <section>
        <h2>How long it is kept</h2>
        <p>
          Your profile and club activity stay for as long as you are a member. Push and
          notification tokens are deleted the moment you turn notifications off or delete your
          account. Chat images are kept with the messages they belong to.
        </p>
      </section>

      <section>
        <h2>Deleting your account</h2>
        <p>
          Open <a href="/profile">My Account</a> in the app and choose <em>Delete my account</em>.
          That immediately cancels any active membership subscription, removes your sign-in,
          push tokens, contact details, headshot, bio, and links, and signs you out everywhere.
          Your name stays on past attendance, weekly log, and chat records so club history and
          reports remain accurate. Directors and admins hand off their club first; email
          <a href="mailto:team@thinkbiz.solutions"> team@thinkbiz.solutions</a> and we will take
          care of it within thirty days.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can ask for a copy of what the app holds about you, ask for corrections, or ask for
          deletion at any time by emailing{' '}
          <a href="mailto:team@thinkbiz.solutions">team@thinkbiz.solutions</a>. We answer within
          thirty days.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          ThinkBiz is for working professionals. The app is not directed at children under 18 and
          we do not knowingly collect data from them.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          When this policy changes we update the date at the top of this page. Material changes
          are announced in the app.
        </p>
      </section>
    </DocPage>
  );
}
