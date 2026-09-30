// Shared chat-safety rules (client-safe: no imports, no side effects).

export type ReportReason = 'harassment' | 'spam' | 'inappropriate' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Offensive or inappropriate' },
  { value: 'spam', label: 'Spam or unwanted promotion' },
  { value: 'other', label: 'Something else' },
];

export function reportReasonLabel(reason: string): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? 'Other';
}

type ModerationMember = {
  id?: string;
  is_admin?: boolean | null;
  club_director?: boolean | null;
  current_club_id?: string | null;
};

// Who may act on a member's chat conduct (review reports about them, remove
// their messages, suspend them from chat): admins for anyone; directors for
// regular members of their own club. Directors and admins themselves are
// moderated by admins only.
export function canModerateMember(viewer: ModerationMember, target: ModerationMember): boolean {
  if (viewer.id && viewer.id === target.id) return false;
  if (viewer.is_admin) return true;
  return (
    !!viewer.club_director &&
    !!viewer.current_club_id &&
    target.current_club_id === viewer.current_club_id &&
    !target.is_admin &&
    !target.club_director
  );
}
