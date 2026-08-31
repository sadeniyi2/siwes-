"use client";

import { loadAccessToken } from "./access";
import { loadEntries, loadProfile } from "./store";
import { applyCloudJSON, entryCount, snapshotJSON } from "./backup";

// Sync the student's logbook to their account (the database is the source of
// truth, the browser is just a cache). All best-effort: any failure is silent
// and the app keeps working locally.

let timer: ReturnType<typeof setTimeout> | null = null;

/** Push the current logbook to the account (debounced). Safe to call often. */
export function pushCloudBackup(delay = 2000) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const token = loadAccessToken();
    if (!token) return;
    const data = snapshotJSON();
    if (!data) return;
    const profile = loadProfile();
    try {
      await fetch("/api/data/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-token": token },
        body: JSON.stringify({
          data,
          matric: profile?.matricNumber,
          name: profile?.fullName,
          email: profile?.email,
        }),
        keepalive: true,
      });
    } catch {
      /* best-effort */
    }
  }, delay);
}

/** Pull the account's logbook and merge it in. Returns the entry count restored,
 *  or -1 if nothing was found / on error. */
export async function pullCloudBackup(): Promise<number> {
  const token = loadAccessToken();
  if (!token) return -1;
  try {
    const res = await fetch("/api/data/load", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-access-token": token },
    });
    const j = await res.json();
    if (!res.ok || !j.ok || !j.found || !j.data) return -1;
    return applyCloudJSON(j.data);
  } catch {
    return -1;
  }
}

/** How many entries a raw account snapshot ({v,data}) holds. */
function remoteEntryCount(json: string): number {
  try {
    const parsed = JSON.parse(json) as { data?: Record<string, string> };
    return parsed?.data ? entryCount(parsed.data) : 0;
  } catch {
    return 0;
  }
}

/**
 * Called once when the app opens. Reconciles this device with the account so a
 * student never has to "upload" anything and never loses work moving between
 * phones:
 *   - If the account's copy has at least as many entries as this device, we
 *     restore it here (the database is the source of truth).
 *   - Otherwise this device is ahead (e.g. brand-new entries not yet synced),
 *     so we push it up instead of clobbering it.
 * Returns the number of entries restored from the account, or -1 if this device
 * was the more complete one (nothing restored).
 */
export async function syncCloudOnLoad(): Promise<number> {
  const token = loadAccessToken();
  if (!token) return -1;

  let remote: string | null = null;
  try {
    const res = await fetch("/api/data/load", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-access-token": token },
    });
    const j = await res.json();
    if (res.ok && j.ok && j.found && j.data) remote = j.data as string;
  } catch {
    // Network hiccup — don't touch local data; a later save will sync up.
    return -1;
  }

  const localCount = loadEntries().length;
  if (remote && remoteEntryCount(remote) >= localCount) {
    // Account copy is as complete (or more) — make this device match it.
    return applyCloudJSON(remote);
  }
  // This device is ahead (or the account is empty) — save it up automatically.
  pushCloudBackup(0);
  return -1;
}
