'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveChatReport, setChatSuspension, type ReportAction } from '@/app/actions/chatSafety';

const CONFIRM: Record<ReportAction, string | null> = {
  remove_message: 'Remove this message from chat for everyone?',
  remove_and_suspend:
    'Remove this message and suspend the member from posting in chat? You can lift the suspension later.',
  dismiss: null,
};

// The three outcomes of a report. Each one closes the report (and any other
// open reports on the same message).
export function ReportActions({
  reportId,
  messageExists,
  canSuspend,
}: {
  reportId: string;
  messageExists: boolean;
  canSuspend: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<ReportAction | null>(null);

  async function run(action: ReportAction) {
    const prompt = CONFIRM[action];
    if (prompt && !window.confirm(prompt)) return;
    setBusy(action);
    const result = await resolveChatReport(reportId, action);
    setBusy(null);
    if (!result.success) {
      window.alert(result.message || 'Something went wrong. Please try again.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => run('remove_message')}
        disabled={!!busy}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {busy === 'remove_message' ? 'Removing…' : messageExists ? 'Remove message' : 'Mark resolved'}
      </button>
      {canSuspend && (
        <button
          type="button"
          onClick={() => run('remove_and_suspend')}
          disabled={!!busy}
          className="rounded-lg border-2 border-red-600 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {busy === 'remove_and_suspend'
            ? 'Working…'
            : messageExists
              ? 'Remove & suspend member'
              : 'Suspend member'}
        </button>
      )}
      <button
        type="button"
        onClick={() => run('dismiss')}
        disabled={!!busy}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
      >
        {busy === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
      </button>
    </div>
  );
}

export function LiftSuspensionButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function lift() {
    setBusy(true);
    const result = await setChatSuspension(memberId, false);
    setBusy(false);
    if (!result.success) {
      window.alert(result.message || 'Something went wrong. Please try again.');
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={lift}
      disabled={busy}
      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
    >
      {busy ? 'Lifting…' : 'Lift suspension'}
    </button>
  );
}
