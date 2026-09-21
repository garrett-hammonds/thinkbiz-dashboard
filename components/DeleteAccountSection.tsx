'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteAccount } from '@/app/actions/deleteAccount';

// The self-serve deletion the app stores require, on the profile page below
// Account Actions. Two steps: a typed confirmation, then the request. Directors
// and admins are refused server-side and told so here, because a club depends
// on their account until it is handed off.
export default function DeleteAccountSection({ canDelete }: { canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready = confirm.trim().toUpperCase() === 'DELETE';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || isPending) return;
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(formData);
      // On success the action redirects; only a failure returns here.
      if (result && !result.success) setError(result.message || 'We couldn’t delete your account.');
    });
  }

  return (
    <div className="bg-white rounded-xl border border-red-100 shadow-card p-8 mb-6">
      <h3 className="text-2xl font-bold leading-snug text-foreground mb-2">Delete my account</h3>
      <p className="text-sm text-gray-600 mb-6">
        This cancels any active membership, removes your sign-in, contact details, headshot, bio,
        and links, and signs you out everywhere. Your name stays on past attendance, weekly logs,
        and chat so club records remain accurate. This cannot be undone.
      </p>

      {!canDelete ? (
        <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600" role="status">
          Directors and admins can’t delete their account here because a club depends on it. Email{' '}
          <a href="mailto:team@thinkbiz.solutions" className="font-medium text-primary hover:text-secondary">
            team@thinkbiz.solutions
          </a>{' '}
          and we’ll hand off your club and remove the account.
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border-2 border-destructive px-6 py-3 font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
        >
          <Trash2 className="h-4 w-4" />
          Delete my account
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="delete-confirm" className="block text-sm font-medium text-gray-900 mb-2">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </label>
            <input
              id="delete-confirm"
              name="confirm"
              autoComplete="off"
              autoCapitalize="characters"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-destructive focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!ready || isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirm('');
                setError(null);
              }}
              disabled={isPending}
              className="rounded-lg px-6 py-3 font-semibold text-gray-600 transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
