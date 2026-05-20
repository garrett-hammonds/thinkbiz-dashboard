'use client';

import { useState } from 'react';
import { acceptDirectorInvite } from '@/app/director-invite/acceptDirectorInvite';

interface Props {
  token: string;
  email: string;
  clubName: string;
}

export default function DirectorInviteForm({ token, email, clubName }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [signInPath, setSignInPath] = useState(false);

  const handleClaim = async () => {
    setIsSubmitting(true);
    setError(null);

    const result = await acceptDirectorInvite({ token });
    setIsSubmitting(false);

    if (result.success) {
      setSignInPath(Boolean(result.message));
      setDone(true);
    } else {
      setError(result.message || 'Failed to claim invite.');
    }
  };

  if (done) {
    if (signInPath) {
      return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">You already have an account</h2>
          <div className="border-t-4 border-primary w-16 mx-auto mb-4" />
          <p className="text-base leading-relaxed text-gray-900 mb-6">
            <strong>{email}</strong> is already registered. Sign in with your existing password
            and we&apos;ll walk you through setting up your {clubName} Director profile.
          </p>
          <a
            href="/login"
            className="inline-block bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200"
          >
            Go to Sign In
          </a>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Check your email</h2>
        <div className="border-t-4 border-primary w-16 mx-auto mb-4" />
        <p className="text-base leading-relaxed text-gray-900">
          We&apos;ve sent a link to <strong>{email}</strong> to set your password. Click it,
          set a password, then sign in to finish setting up your {clubName} Director profile.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 space-y-5">
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
        <input
          type="email"
          readOnly
          value={email}
          className="w-full rounded-lg border border-gray-300 p-3 text-gray-700 bg-slate-50"
        />
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">
        Click below to claim your Club Director account for <strong>{clubName}</strong>. We&apos;ll
        email you a link to set a password. After signing in you&apos;ll be walked through a short
        profile setup before you reach your dashboard.
      </p>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleClaim}
        disabled={isSubmitting}
        className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50"
      >
        {isSubmitting ? 'Sending email...' : 'Claim My Account'}
      </button>
    </div>
  );
}
