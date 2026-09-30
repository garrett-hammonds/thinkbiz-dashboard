"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { reportChatMessage } from "@/app/actions/chatSafety";
import { REPORT_REASONS, type ReportReason } from "@/lib/chat/safety";
import type { ChatMessage } from "./types";

// Report a chat message to the club's directors and ThinkBiz admins.
export function ReportMessageModal({
  message,
  authorName,
  onClose,
}: {
  message: ChatMessage;
  authorName: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await reportChatMessage(message.id, reason, details);
      if (!result.success) {
        setError(result.message || "Could not send the report. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Could not send the report. Please try again.");
    }
    setSending(false);
  };

  if (sent) {
    return (
      <Modal title="Thanks for reporting" onClose={onClose}>
        <p className="mb-6 text-sm text-gray-600">
          Your report was sent to your club&apos;s directors and the ThinkBiz team. They review every
          report within 24 hours and will remove anything that breaks the chat guidelines.
          {" "}
          {authorName} won&apos;t know who reported it.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary"
        >
          Done
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Report message" onClose={() => !sending && onClose()}>
      <p className="mb-4 text-sm text-gray-500">
        Why are you reporting this message from <strong>{authorName}</strong>?
      </p>
      <fieldset className="mb-4 space-y-2">
        <legend className="sr-only">Reason</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r.value}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              reason === r.value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary"
            }`}
          >
            <input
              type="radio"
              name="report-reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="accent-primary"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      <label htmlFor="report-details" className="mb-1 block text-sm font-semibold text-foreground">
        Details <span className="font-normal text-gray-500">(optional)</span>
      </label>
      <textarea
        id="report-details"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={1000}
        rows={3}
        className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!reason || sending}
        className="w-full rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send report"}
      </button>
    </Modal>
  );
}
