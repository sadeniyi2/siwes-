"use client";

import { loadAccessToken } from "./access";
import { loadProfile } from "./store";
import { applyCloudJSON, snapshotJSON } from "./backup";

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
