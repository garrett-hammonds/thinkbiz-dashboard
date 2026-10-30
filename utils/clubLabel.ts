// Club pickers (the /apply form, the director invite form) used to list clubs
// by name only, and some clubs share a name because they meet in the same city
// at the same time — two "Oklahoma City - Tuesday 9:30am" clubs, at different
// buildings. The street address tells them apart.

export const CLUB_PICKER_FIELDS = 'id, name, display_name, venue_name, address, day_of_week, start_time';

export type ClubPickerOption = {
  id: string;
  name: string | null;
  display_name: string | null;
  venue_name: string | null;
  address: string | null;
  day_of_week: string | null;
  start_time: string | null;
};

// First line of the address ("500 N Meridian Ave Ste 208"), else the venue.
export function clubStreet(club: Pick<ClubPickerOption, 'address' | 'venue_name'>): string | null {
  return club.address?.split(',')[0]?.trim() || club.venue_name?.trim() || null;
}

// "Oklahoma City - Tuesday 9:30am — 500 N Meridian Ave Ste 208"
export function clubOptionLabel(club: ClubPickerOption): string {
  const name = club.name?.trim() || club.display_name?.trim() || 'Unnamed club';
  const street = clubStreet(club);
  return street ? `${name} — ${street}` : name;
}

// Picker order: by name, and clubs that share a name by their address.
export function sortClubOptions<T extends ClubPickerOption>(clubs: T[]): T[] {
  return [...clubs].sort(
    (a, b) =>
      (a.name || '').localeCompare(b.name || '') ||
      (a.address || '').localeCompare(b.address || ''),
  );
}
