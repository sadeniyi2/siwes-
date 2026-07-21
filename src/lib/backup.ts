"use client";

// Backup & restore for everything the app keeps in this browser. Because all
// user data (profile, logbook entries, chat memory, key and access) lives in
// localStorage, clearing the browser wipes it. A backup file lets a student
// keep a copy and restore it on any device or after clearing history.

const PREFIX = "siwes.";

export interface BackupFile {
  app: "siwes-logbook";
  version: number;
  exportedAt: string;
  data: Record<string, string>;
}

/** Gather all app data into a plain object. */
function collect(): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) data[k] = localStorage.getItem(k) ?? "";
  }
  return data;
}

/** How many logbook entries a backup holds (for a friendly summary). */
export function entryCount(data: Record<string, string>): number {
  try {
    const raw = data["siwes.entries.v1"];
    if (!raw) return 0;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/** Download a backup of everything as a .json file. */
export function exportData(): number {
  const data = collect();
  const payload: BackupFile = {
    app: "siwes-logbook",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `siwes-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return entryCount(data);
}

export interface RestoreResult {
  ok: boolean;
  count: number;
  entries: number;
  error?: string;
}

/** Restore data from a previously downloaded backup file. */
export async function importData(file: File): Promise<RestoreResult> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<BackupFile>;
    const data = parsed?.data;
    if (parsed?.app !== "siwes-logbook" || !data || typeof data !== "object") {
      return {
        ok: false,
        count: 0,
        entries: 0,
        error: "That doesn't look like a SIWES backup file.",
      };
    }
    let count = 0;
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith(PREFIX) && typeof v === "string") {
        localStorage.setItem(k, v);
        count++;
      }
    }
    return { ok: true, count, entries: entryCount(data) };
  } catch {
    return {
      ok: false,
      count: 0,
      entries: 0,
      error: "Couldn't read that file. Make sure it's the backup you downloaded.",
    };
  }
}
