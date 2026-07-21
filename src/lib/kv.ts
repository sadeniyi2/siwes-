import "server-only";

// User/trial tracking for the founder panel, backed by Supabase (free Postgres).
// Configure with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. The service-role key
// is used ONLY here in server routes (never sent to the browser). If unset,
// tracking silently no-ops and the panel shows a "connect a store" note —
// sales still work from Flutterwave.
//
// One-time table setup (run in Supabase → SQL editor):
//   create table if not exists siwes_users (
//     id text primary key,
//     name text, email text, firm text,
//     kind text, tier text,
//     trial_exp bigint,
//     first_seen bigint, last_seen bigint
//   );

const SB_URL = process.env.SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE = "siwes_users";

export function kvConfigured(): boolean {
  return !!SB_URL && !!SB_KEY;
}

function sb(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

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

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  firm: string | null;
  kind: string | null;
  tier: string | null;
  trial_exp: number | null;
  first_seen: number | null;
  last_seen: number | null;
}

/** Upsert a user record (read existing, merge, write). */
export async function upsertUser(
  id: string,
  patch: Partial<UserRecord>,
): Promise<void> {
  if (!kvConfigured() || !id) return;

  let existing: Row | null = null;
  try {
    const r = await sb(
      `${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`,
      { method: "GET" },
    );
    if (r.ok) {
      const rows = (await r.json()) as Row[];
      existing = rows?.[0] ?? null;
    }
  } catch {
    /* ignore */
  }

  const now = Date.now();
  const row: Row = {
    id,
    first_seen: existing?.first_seen ?? now,
    last_seen: now,
    name: patch.name ?? existing?.name ?? null,
    email: patch.email ?? existing?.email ?? null,
    firm: patch.firm ?? existing?.firm ?? null,
    kind: patch.kind ?? existing?.kind ?? null,
    tier: patch.tier ?? existing?.tier ?? null,
    trial_exp: patch.trialExp ?? existing?.trial_exp ?? null,
  };

  try {
    await sb(TABLE, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(row),
    });
  } catch {
    /* ignore */
  }
}

export async function listUsers(): Promise<UserRecord[]> {
  if (!kvConfigured()) return [];
  try {
    const r = await sb(
      `${TABLE}?select=*&order=last_seen.desc&limit=2000`,
      { method: "GET" },
    );
    if (!r.ok) return [];
    const rows = (await r.json()) as Row[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? undefined,
      email: row.email ?? undefined,
      firm: row.firm ?? undefined,
      kind: row.kind ?? undefined,
      tier: row.tier ?? undefined,
      trialExp: row.trial_exp ?? undefined,
      firstSeen: row.first_seen ?? 0,
      lastSeen: row.last_seen ?? 0,
    }));
  } catch {
    return [];
  }
}
