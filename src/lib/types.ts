export const SIWES_START_DATE = "2026-07-13"; // Monday, 13 July 2026
export const WORK_DAYS = ["MON", "TUE", "WED", "THUR", "FRI", "SAT"] as const;

export interface LogEntry {
  /** ISO date, e.g. "2026-07-13" — unique key */
  date: string;
  /** "Monday" ... "Saturday" */
  day: string;
  /** The polished 35–70 word logbook paragraph */
  description: string;
  /** The raw notes the student typed, kept for report building */
  rawNotes?: string;
  savedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  /** Serialized internship memory injected into the model's context */
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

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
