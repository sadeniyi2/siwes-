export const WORK_DAYS = ["MON", "TUE", "WED", "THUR", "FRI", "SAT"] as const;

export interface Profile {
  fullName: string;
  matricNumber?: string;
  /** Email — optional, used for receipts and password-reset links. */
  email?: string;
  institution?: string;
  course?: string;
  firmName: string;
  firmAddress?: string;
  department?: string;
  supervisorName?: string;
  /** ISO date the internship started, e.g. "2026-08-03" */
  startDate: string;
  /** Planned length in weeks (used for the progress display) */
  durationWeeks?: number;
  /** Whether the student works on Saturdays */
  worksSaturday: boolean;
}

export interface LogEntry {
  /** ISO date, e.g. "2026-07-13" — unique key */
  date: string;
  /** "Monday" ... "Saturday" */
  day: string;
  /** The polished 35–70 word logbook paragraph */
  description: string;
  /** The raw notes the student typed, kept for report building */
  rawNotes?: string;
  /** Optional attached photos, stored as compressed data URLs */
  photos?: string[];
  /** Optional skill/competency tags for this day */
  skills?: string[];
  savedAt: string;
}

export interface ChatImage {
  /** MIME type, e.g. "image/jpeg". */
  mimeType: string;
  /** Base64-encoded image bytes, WITHOUT the "data:...;base64," prefix. */
  data: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Optional images the student attached to this (user) turn. */
  images?: ChatImage[];
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  /** Serialized internship memory + student profile injected into context */
  memory: string;
}

export function dayNameFromISO(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    d.getUTCDay()
  ];
}

export function formatLongDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Monday of the week containing the given ISO date */
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = d.getUTCDay(); // 0 = Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1-based internship week number for a date, given the start date */
export function weekNumberOf(dateISO: string, startISO: string): number {
  const start = mondayOf(startISO);
  return (
    Math.floor(
      (new Date(dateISO + "T12:00:00Z").getTime() -
        new Date(start + "T12:00:00Z").getTime()) /
        (7 * 24 * 3600 * 1000),
    ) + 1
  );
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
