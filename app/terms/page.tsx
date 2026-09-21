import type { Metadata } from 'next';
import DocPage from '@/components/legal/DocPage';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Terms of Use — ThinkBiz',
  description: 'The terms under which ThinkBiz Solutions members use the ThinkBiz web and mobile app.',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <DocPage
      title="Terms of Use"
      intro="Using the ThinkBiz app means you agree to the points below. They are short on purpose."
      updated="September 21, 2026"
    >
      <section>
        <h2>Who may use it</h2>
        <p>
          Approved members of a ThinkBiz Solutions club, and the directors and admins who run
          them. Anyone can apply to join through the app; a club director reviews and approves
          each application. You must be at least 18.
        </p>
      </section>

      <section>
        <h2>Membership and billing</h2>
        <p>
          Where a club charges membership dues, they are billed as a recurring subscription
          through Stripe and cover your participation in the club&apos;s meetings and community.
          You can update your payment method or cancel at any time from My Account. Cancelling
          stops future charges; dues already paid are not refunded except where the law requires.
        </p>
      </section>

      <section>
        <h2>What you agree to</h2>
        <ul>
          <li>Keep your sign-in details to yourself and sign out on shared devices.</li>
          <li>Keep your profile and weekly logs honest; other members and directors rely on them.</li>
          <li>Be respectful in chat. No harassment, spam, or content that is unlawful or that you do not have the right to share.</li>
          <li>Use other members&apos; contact details only for club networking, never for bulk marketing.</li>
          <li>Do not attempt to access data or clubs you are not a member of.</li>
        </ul>
        <p>
          Directors and admins may remove content or members that break these rules. You can
          report a concern to <a href="mailto:team@thinkbiz.solutions">team@thinkbiz.solutions</a>.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You keep ownership of what you post. You give ThinkBiz Solutions permission to store and
          show it to the members it is addressed to so the app can work.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          The app is provided as is. ThinkBiz Solutions aims to keep it running but makes no
          promise of uptime, and may change or retire features at any time.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms go to{' '}
          <a href="mailto:team@thinkbiz.solutions">team@thinkbiz.solutions</a>.
        </p>
      </section>
    </DocPage>
  );
}
