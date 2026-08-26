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

/** Data keys that are safe/useful to sync to the cloud. Access tokens are
 *  intentionally excluded — cloud backup restores logbook DATA, not access. */
const CLOUD_KEYS = [
  "siwes.profile.v1",
  "siwes.entries.v1",
  "siwes.chat.v1",
  "siwes.section",
];

/** Build a compact snapshot of the student's logbook data for cloud backup.
 *  If it's too big (usually because of photos), drop photo attachments so the
 *  logbook text still gets backed up reliably. */
export function snapshotJSON(maxBytes = 600000): string | null {
  const data: Record<string, string> = {};
  for (const k of CLOUD_KEYS) {
    const v = localStorage.getItem(k);
    if (v) data[k] = v;
  }
  if (!data["siwes.entries.v1"] && !data["siwes.profile.v1"]) return null;
  let json = JSON.stringify({ v: 1, data });
  if (json.length > maxBytes && data["siwes.entries.v1"]) {
    try {
      const entries = JSON.parse(data["siwes.entries.v1"]);
      if (Array.isArray(entries)) {
        for (const e of entries) delete e.photos; // photos are the heavy part
        data["siwes.entries.v1"] = JSON.stringify(entries);
        json = JSON.stringify({ v: 1, data });
      }
    } catch {
      /* ignore */
    }
  }
  return json;
}

/** Remove the student's cached logbook data (used on logout / account switch). */
export function clearLocalData() {
  for (const k of CLOUD_KEYS) localStorage.removeItem(k);
}

/** True if this browser currently holds any logbook data. */
export function hasLocalData(): boolean {
  return CLOUD_KEYS.some((k) => !!localStorage.getItem(k));
}

/** Replace local logbook data with a cloud snapshot. Returns entry count. */
export function applyCloudJSON(json: string): number {
  try {
    const parsed = JSON.parse(json) as { data?: Record<string, string> };
    const data = parsed?.data;
    if (!data || typeof data !== "object") return 0;
    clearLocalData(); // clean replace so accounts never mix on a shared browser
    for (const [k, v] of Object.entries(data)) {
      if (CLOUD_KEYS.includes(k) && typeof v === "string") {
        localStorage.setItem(k, v);
      }
    }
    return entryCount(data);
  } catch {
    return 0;
  }
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
