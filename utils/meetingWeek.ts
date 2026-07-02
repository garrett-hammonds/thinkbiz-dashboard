// Weekly meeting-slot math for club attendance.
//
// A club has one fixed meeting weekday (`clubs.meeting_day`, 0=Sunday..6=
// Saturday). Attendance rows are keyed to the *date of that weekday's
// occurrence*, so week-over-week stats line up even when a scan happens on a
// different day (a moved meeting, or a meeting that runs past midnight —
// including the server clock being a few hours ahead of the room in UTC).
//
// The mapping rule is "nearest occurrence": a scan maps to the occurrence of
// the meeting day within ±3 days. That deliberately tolerates timezone skew
// and moved meetings without ever being ambiguous.
//
// All dates are plain calendar dates handled as UTC-midnight Date objects and
// YYYY-MM-DD strings; no wall-clock times are involved.

export const MEETING_DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Today's calendar date where the server runs, pinned to UTC midnight so all
// downstream arithmetic is pure date math.
export function todayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

// The meeting slot a check-in on `date` counts toward: the occurrence of
// `meetingDay` nearest to `date` (forward up to 3 days, otherwise the most
// recent past occurrence).
export function meetingSlotFor(date: Date, meetingDay: number): string {
  const forward = (meetingDay - date.getUTCDay() + 7) % 7;
  const offset = forward <= 3 ? forward : forward - 7;
  const slot = new Date(date);
  slot.setUTCDate(slot.getUTCDate() + offset);
  return toIsoDate(slot);
}

// The current week's slot as of today.
export function currentMeetingSlot(meetingDay: number): string {
  return meetingSlotFor(todayDate(), meetingDay);
}

// The trailing `count` weekly slots ending with (and including) `endSlot`,
// oldest first — the x-axis of the attendance trend chart.
export function trailingMeetingSlots(endSlot: string, count: number): string[] {
  const slots: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    slots.push(addDaysIso(endSlot, -7 * i));
  }
  return slots;
}

// True when `isoDate` is a well-formed YYYY-MM-DD calendar date and lands on
// the club's meeting day — the only dates attendance rows may be keyed to.
export function isValidMeetingSlot(isoDate: string, meetingDay: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || toIsoDate(d) !== isoDate) return false;
  return d.getUTCDay() === meetingDay;
}

// "Tuesday, Jul 1" style label for a slot date, without pulling in a date lib.
export function formatSlotLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

// Short "Jul 1" label for chart ticks.
export function formatSlotTick(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
