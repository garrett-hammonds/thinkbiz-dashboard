// Small, dependency-free input guards for the public/anon forms (visitor
// check-in, membership application) and onboarding. These endpoints accept
// free-text that lands in the database and, in some cases, in outbound email,
// so we bound length to stop unbounded stored content / storage abuse. React
// escapes on render and the email templates escape too, so this is about size,
// not markup.

// Sensible caps per field kind. Generous enough for real input, tight enough
// that a single submission can't stuff megabytes into a row.
export const FIELD_LIMITS = {
  name: 100,
  email: 254, // RFC 5321 max
  phone: 40,
  shortText: 200, // company, title, single-line fields
  longText: 5000, // bio, notes
  skills: 1000,
} as const;

export type FieldLimit = keyof typeof FIELD_LIMITS;

// Returns a human-readable error string if `value` exceeds the named limit,
// otherwise null. Presence/required checks stay with each caller.
export function overLimit(label: string, value: string | null | undefined, kind: FieldLimit): string | null {
  const max = FIELD_LIMITS[kind];
  if (value && value.length > max) {
    return `${label} must be ${max} characters or fewer.`;
  }
  return null;
}

// Runs several field checks and returns the first error, or null if all pass.
export function firstLengthError(
  checks: Array<[label: string, value: string | null | undefined, kind: FieldLimit]>,
): string | null {
  for (const [label, value, kind] of checks) {
    const err = overLimit(label, value, kind);
    if (err) return err;
  }
  return null;
}
