'use client';

import { useFormStatus } from 'react-dom';

// Submit button for plain server-action forms (`<form action={...}>`). Those
// forms have no client-side state, so a click previously gave no feedback during
// the network round-trip — the button stayed fully active, so a member on a slow
// connection got silence and was invited to click again. useFormStatus reads the
// pending state of the enclosing form and reflects it: the button disables and
// swaps to a "working" label, making every submit feel responsive and blocking
// accidental double submissions.
export default function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
