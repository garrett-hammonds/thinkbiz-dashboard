'use client';

import { useState } from 'react';
import { createDirectorInvite } from '@/app/actions/createDirectorInvite';

interface Club {
  id: string;
  name: string;
}

export default function InviteDirectorForm({ clubs }: { clubs: Club[] }) {
  const [email, setEmail] = useState('');
  const [clubId, setClubId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setInviteUrl(null);
    setCopied(false);

    const result = await createDirectorInvite(email, clubId);
    setIsSubmitting(false);

    if (result.success && result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
    } else {
      setError(result.message || 'Failed to create invite.');
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Director Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Club</label>
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            required
          >
            <option value="">Select a club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50"
        >
          {isSubmitting ? 'Generating...' : 'Generate Invite Link'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {inviteUrl && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Share this link with the director:</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-lg border border-gray-300 p-3 text-sm text-gray-900 bg-slate-50"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="bg-primary text-white hover:bg-secondary rounded-lg px-4 py-3 font-semibold transition-colors duration-200"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Link expires in 7 days. It can be used once to provision the director.
          </p>
        </div>
      )}
    </div>
  );
}
