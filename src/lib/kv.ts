import "server-only";

// Lightweight Upstash Redis REST client (no SDK) for the founder panel.
// Configure with UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (both free
// from upstash.com). If unset, tracking silently no-ops and the panel shows a
// "connect a store" note — sales still work from Flutterwave.

const URL_ = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

export function kvConfigured(): boolean {
  return !!URL_ && !!TOKEN;
}

async function cmd<T = unknown>(command: (string | number)[]): Promise<T | null> {
  if (!kvConfigured()) return null;
  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.result ?? null) as T;
  } catch {
    return null;
  }
}

const USERS_KEY = "siwes:users";

export interface UserRecord {
  id: string;
  name?: string;
  email?: string;
  firm?: string;
  kind?: string; // paid | free | trial
  tier?: string; // basic | pro
  trialExp?: number;
  firstSeen: number;
  lastSeen: number;
}

/** Upsert a user record (merge with any existing one). */
export async function upsertUser(
  id: string,
  patch: Partial<UserRecord>,
): Promise<void> {
  if (!kvConfigured() || !id) return;
  const existingRaw = await cmd<string>(["HGET", USERS_KEY, id]);
  let existing: UserRecord | null = null;
  if (existingRaw) {
    try {
      existing = JSON.parse(existingRaw) as UserRecord;
    } catch {
      existing = null;
    }
  }
  const now = Date.now();
  const merged: UserRecord = {
    id,
    firstSeen: existing?.firstSeen ?? now,
    lastSeen: now,
    name: patch.name ?? existing?.name,
    email: patch.email ?? existing?.email,
    firm: patch.firm ?? existing?.firm,
    kind: patch.kind ?? existing?.kind,
    tier: patch.tier ?? existing?.tier,
    trialExp: patch.trialExp ?? existing?.trialExp,
  };
  await cmd(["HSET", USERS_KEY, id, JSON.stringify(merged)]);
}

export async function listUsers(): Promise<UserRecord[]> {
  const flat = await cmd<string[]>(["HGETALL", USERS_KEY]);
  if (!flat || !Array.isArray(flat)) return [];
  const out: UserRecord[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    try {
      out.push(JSON.parse(flat[i + 1]) as UserRecord);
    } catch {
      /* skip bad rows */
    }
  }
  return out;
}
