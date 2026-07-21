import { LogEntry, Profile, addDays, dayNameFromISO } from "./types";

/** Local (not UTC) today as an ISO date string. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function isWorkday(iso: string, worksSaturday: boolean): boolean {
  const day = dayNameFromISO(iso);
  if (day === "Sunday") return false;
  if (day === "Saturday") return worksSaturday;
  return true;
}

function prevWorkday(iso: string, worksSaturday: boolean): string {
  let c = addDays(iso, -1);
  let guard = 0;
  while (!isWorkday(c, worksSaturday) && guard++ < 10) c = addDays(c, -1);
  return c;
}

/** Consecutive working days with an entry, counting back from the latest entry. */
export function computeStreak(entries: LogEntry[], profile: Profile): number {
  if (entries.length === 0) return 0;
  const dates = new Set(entries.map((e) => e.date));
  const latest = entries.reduce((a, e) => (e.date > a ? e.date : a), entries[0].date);
  let streak = 0;
  let cursor = latest;
  let guard = 0;
  while (dates.has(cursor) && guard++ < 400) {
    streak++;
    cursor = prevWorkday(cursor, profile.worksSaturday);
  }
  return streak;
}

/**
 * Recent working days (before today) that have no saved entry — used to gently
 * nudge the student. Returns up to `max` dates, most recent first, never going
 * before the internship start date.
 */
export function missingRecentWorkdays(
  entries: LogEntry[],
  profile: Profile,
  max = 4,
): string[] {
  const dates = new Set(entries.map((e) => e.date));
  const missing: string[] = [];
  let cursor = prevWorkday(todayISO(), profile.worksSaturday);
  let guard = 0;
  while (missing.length < max && cursor >= profile.startDate && guard++ < 40) {
    if (isWorkday(cursor, profile.worksSaturday) && !dates.has(cursor)) {
      missing.push(cursor);
    }
    cursor = addDays(cursor, -1);
  }
  return missing;
}
