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
//   create table if not exists siwes_codes (
//     code text primary key,
//     tier text default 'pro',
//     note text,
//     uses bigint default 0,
//     created bigint
//   );
//   create table if not exists siwes_trials (
//     matric text primary key,
//     ip text, name text,
//     started bigint, exp bigint
//   );

const SB_URL = process.env.SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE = "siwes_users";
const CODES = "siwes_codes";
const TRIALS = "siwes_trials";

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

// ---------------------------------------------------------------------------
// Referral / access codes. A valid code grants free Pro access. Codes can be
// managed from the Founder Panel (stored in Supabase) and/or set permanently
// via the REFERRAL_CODES env var (comma/semicolon separated). Codes are matched
// case-insensitively.
// ---------------------------------------------------------------------------

export interface CodeRecord {
  code: string;
  tier: string; // basic | pro (defaults to pro)
  note?: string;
  uses: number;
  created: number;
}

interface CodeRow {
  code: string;
  tier: string | null;
  note: string | null;
  uses: number | null;
  created: number | null;
}

function envCodes(): string[] {
  return (process.env.REFERRAL_CODES || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validate a code. Returns the tier it grants, or null if invalid.
 *  Checks the env list first, then Supabase. Best-effort increments the
 *  usage counter for Supabase-stored codes. */
export async function validateCode(
  input: string,
): Promise<{ tier: "basic" | "pro" } | null> {
  const code = input.trim();
  if (!code) return null;
  const lower = code.toLowerCase();

  // Env-var codes always grant Pro.
  if (envCodes().some((c) => c.toLowerCase() === lower)) {
    return { tier: "pro" };
  }

  if (!kvConfigured()) return null;
  try {
    const r = await sb(
      `${CODES}?code=eq.${encodeURIComponent(code)}&select=*`,
      { method: "GET" },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as CodeRow[];
    const row = rows?.[0];
    if (!row) return null;
    // Bump usage counter (best-effort).
    void sb(`${CODES}?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify({ uses: (row.uses ?? 0) + 1 }),
    }).catch(() => {});
    const tier = row.tier === "basic" ? "basic" : "pro";
    return { tier };
  } catch {
    return null;
  }
}

export async function listCodes(): Promise<CodeRecord[]> {
  const env: CodeRecord[] = envCodes().map((code) => ({
    code,
    tier: "pro",
    note: "from environment (permanent)",
    uses: 0,
    created: 0,
  }));
  if (!kvConfigured()) return env;
  try {
    const r = await sb(`${CODES}?select=*&order=created.desc&limit=500`, {
      method: "GET",
    });
    if (!r.ok) return env;
    const rows = (await r.json()) as CodeRow[];
    const stored = rows.map((row) => ({
      code: row.code,
      tier: row.tier === "basic" ? "basic" : "pro",
      note: row.note ?? undefined,
      uses: row.uses ?? 0,
      created: row.created ?? 0,
    }));
    return [...stored, ...env];
  } catch {
    return env;
  }
}

export async function addCode(
  code: string,
  tier: "basic" | "pro",
  note?: string,
): Promise<boolean> {
  if (!kvConfigured() || !code.trim()) return false;
  try {
    const r = await sb(CODES, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        code: code.trim(),
        tier,
        note: note?.trim() || null,
        uses: 0,
        created: Date.now(),
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function deleteCode(code: string): Promise<boolean> {
  if (!kvConfigured() || !code.trim()) return false;
  try {
    const r = await sb(`${CODES}?code=eq.${encodeURIComponent(code.trim())}`, {
      method: "DELETE",
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Trial de-duplication. One free trial per matric number, tracked server-side
// so clearing the browser / using incognito / a new device can't get a second
// one. IP is recorded too, to throttle someone inventing many fake matrics.
// ---------------------------------------------------------------------------

export function normalizeMatric(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

interface TrialRow {
  matric: string;
  ip: string | null;
  name: string | null;
  started: number | null;
  exp: number | null;
}

/** Has this matric number already taken a trial? */
export async function trialExistsForMatric(matric: string): Promise<boolean> {
  if (!kvConfigured()) return false;
  try {
    const r = await sb(
      `${TRIALS}?matric=eq.${encodeURIComponent(matric)}&select=matric`,
      { method: "GET" },
    );
    if (!r.ok) return false;
    const rows = (await r.json()) as TrialRow[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** How many trials this IP started since `sinceMs` (0 = all time). Used as a
 *  soft abuse throttle — kept lenient because campus/mobile networks share IPs. */
export async function trialCountForIp(ip: string, sinceMs = 0): Promise<number> {
  if (!kvConfigured() || !ip) return 0;
  try {
    const since = sinceMs ? `&started=gt.${sinceMs}` : "";
    const r = await sb(
      `${TRIALS}?ip=eq.${encodeURIComponent(ip)}${since}&select=matric&limit=200`,
      { method: "GET" },
    );
    if (!r.ok) return 0;
    const rows = (await r.json()) as TrialRow[];
    return rows.length;
  } catch {
    return 0;
  }
}

export interface TrialRecord {
  matric: string;
  ip?: string;
  name?: string;
  started: number;
  exp: number;
}

/** All recorded trials, most recent first (founder monitoring). */
export async function listTrials(): Promise<TrialRecord[]> {
  if (!kvConfigured()) return [];
  try {
    const r = await sb(`${TRIALS}?select=*&order=started.desc&limit=2000`, {
      method: "GET",
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as TrialRow[];
    return rows.map((row) => ({
      matric: row.matric,
      ip: row.ip ?? undefined,
      name: row.name ?? undefined,
      started: row.started ?? 0,
      exp: row.exp ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Record a started trial. Returns false only on a hard write failure. */
export async function recordTrial(
  matric: string,
  ip: string,
  name: string,
  exp: number,
): Promise<boolean> {
  if (!kvConfigured()) return true; // nothing to record, allow
  try {
    const r = await sb(TRIALS, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        matric,
        ip: ip || null,
        name: name || null,
        started: Date.now(),
        exp,
      }),
    });
    return r.ok;
  } catch {
    return false;
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
