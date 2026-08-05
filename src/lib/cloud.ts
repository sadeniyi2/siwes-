"use client";

import { loadAccessToken } from "./access";
import { loadProfile } from "./store";
import { applyCloudJSON, snapshotJSON } from "./backup";

// Automatic cloud backup of the student's logbook, keyed by their matric number,
// so their data survives switching phones/browsers or clearing history. All
// best-effort: any failure is silent and the app keeps working locally.

let timer: ReturnType<typeof setTimeout> | null = null;

/** Push the current logbook to the cloud (debounced). Safe to call often. */
export function pushCloudBackup(delay = 2500) {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const profile = loadProfile();
    const token = loadAccessToken();
    const matric = profile?.matricNumber?.trim();
    if (!matric || !token) return;
    const data = snapshotJSON();
    if (!data) return;
    try {
      await fetch("/api/backup/save", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-access-token": token },
        body: JSON.stringify({ matric, name: profile?.fullName, data }),
        keepalive: true,
      });
    } catch {
      /* best-effort */
    }
  }, delay);
}

/** Fetch a cloud backup for a matric number. Returns the entry count restored,
 *  or -1 if nothing was found / on error. Only restores when asked to. */
export async function pullCloudBackup(matric: string): Promise<number> {
  const token = loadAccessToken();
  const m = matric.trim();
  if (!token || !m) return -1;
  try {
    const res = await fetch("/api/backup/load", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-access-token": token },
      body: JSON.stringify({ matric: m }),
    });
    const j = await res.json();
    if (!res.ok || !j.ok || !j.found || !j.data) return -1;
    return applyCloudJSON(j.data);
  } catch {
    return -1;
  }
}
