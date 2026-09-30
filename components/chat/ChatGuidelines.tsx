"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { acceptChatGuidelines } from "@/app/actions/chatSafety";

export const CHAT_RULES = [
  "Be respectful. No harassment, bullying, threats, or hate speech.",
  "No sexual, violent, or otherwise objectionable content.",
  "No spam, bulk promotion, or content you don't have the right to share.",
];

// Shown once, before chat opens for the first time. Accepting is recorded on
// the member (members.chat_guidelines_accepted_at).
export function ChatGuidelines() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptChatGuidelines();
      if (!result.success) {
        setError(result.message || "Something went wrong. Please try again.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-100 bg-white p-8 shadow-card">
        <ShieldCheck className="mb-4 h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mb-2 text-2xl font-bold leading-snug text-foreground">Member chat guidelines</h1>
        <p className="mb-4 text-sm text-gray-500">
          ThinkBiz chat is for real business relationships. We have zero tolerance for abusive or
          objectionable content or behavior.
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-5 text-sm text-gray-700">
          {CHAT_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="mb-6 text-sm text-gray-500">
          You can report any message, and block anyone from direct messaging you. Club directors and
          ThinkBiz admins review every report within 24 hours. They remove content that breaks these
          rules and can suspend the member who posted it.
        </p>
        <button
          type="button"
          onClick={accept}
          disabled={pending}
          className="w-full rounded-lg bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {pending ? "Saving…" : "I agree"}
        </button>
        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        <p className="mt-4 text-center text-xs text-gray-400">
          See the full{" "}
          <Link href="/terms" className="hover:text-primary">
            Terms of Use
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
