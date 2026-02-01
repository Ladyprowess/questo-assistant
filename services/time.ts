import { formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";

/**
 * Convert a user's local date+time (in their chosen timezone) into a UTC ISO string for storage.
 * Example input: date="2026-02-01", time="17:00", tz="Africa/Lagos"
 */
export function toUtcIsoFromLocalParts(dateYYYYMMDD: string, timeHHMM: string, timeZone: string) {
  const localIsoLike = `${dateYYYYMMDD}T${timeHHMM}:00`; // no Z on purpose
  const utcDate = zonedTimeToUtc(localIsoLike, timeZone);
  return utcDate.toISOString();
}

/**
 * Display a stored UTC date (string) in the user's timezone.
 */
export function formatUtcInTz(
  utcIso: string,
  timeZone: string,
  pattern = "eee, d MMM yyyy • h:mm a"
) {
  return formatInTimeZone(new Date(utcIso), timeZone, pattern);
}
