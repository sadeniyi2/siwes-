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
//   create table if not exists siwes_blocks (
//     value text primary key,   -- a matric number or an IP address
//     type text, reason text, created bigint
//   );

const SB_URL = process.env.SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TABLE = "siwes_users";
const CODES = "siwes_codes";
const CODE_USES = "siwes_code_uses";
const TRIALS = "siwes_trials";
const BLOCKS = "siwes_blocks";
const AI_KEYS = "siwes_ai_keys";
const USAGE = "siwes_usage";
const BACKUPS = "siwes_backups";

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

export interface CodeUse {
  name?: string;
  ip?: string;
  at: number;
}

export interface CodeRecord {
  code: string;
  tier: string; // basic | pro (defaults to pro)
  note?: string;
  uses: number;
  maxUses?: number; // device limit; undefined = unlimited
  created: number;
  redeemers?: CodeUse[]; // who has used it
}

interface CodeRow {
  code: string;
  tier: string | null;
  note: string | null;
  uses: number | null;
  max_uses: number | null;
  created: number | null;
}

function envCodes(): string[] {
  return (process.env.REFERRAL_CODES || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Codes are stored and matched uppercase, so any typed case works. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Validate a code. Returns the tier it grants, or null if invalid.
 *  Checks the env list first, then Supabase. Best-effort increments the
 *  usage counter for Supabase-stored codes. */
export async function validateCode(
  input: string,
): Promise<{ tier: "basic" | "pro" } | null> {
  const code = normalizeCode(input);
  if (!code) return null;
  const lower = code.toLowerCase();

  // Env-var codes always grant Pro.
  if (envCodes().some((c) => c.toLowerCase() === lower)) {
    return { tier: "pro" };
  }

  if (!kvConfigured()) return null;
  try {
    // Match case-insensitively so students can type the code in any case.
    const r = await sb(
      `${CODES}?code=eq.${encodeURIComponent(code)}&select=*`,
      { method: "GET" },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as CodeRow[];
    const row = rows?.[0];
    if (!row) return null;
    // Enforce the device limit: once used up, the code stops working.
    const uses = row.uses ?? 0;
    if (row.max_uses != null && uses >= row.max_uses) return null;
    // Bump usage counter (best-effort).
    void sb(`${CODES}?code=eq.${encodeURIComponent(row.code)}`, {
      method: "PATCH",
      body: JSON.stringify({ uses: uses + 1 }),
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
    const [codesRes, uses] = await Promise.all([
      sb(`${CODES}?select=*&order=created.desc&limit=500`, { method: "GET" }),
      listCodeUses(),
    ]);
    if (!codesRes.ok) return env;
    const rows = (await codesRes.json()) as CodeRow[];
    // Group redeemers by code.
    const byCode = new Map<string, CodeUse[]>();
    for (const u of uses) {
      const arr = byCode.get(u.code) ?? [];
      arr.push({ name: u.name, ip: u.ip, at: u.at });
      byCode.set(u.code, arr);
    }
    const stored = rows.map((row) => ({
      code: row.code,
      tier: row.tier === "basic" ? "basic" : "pro",
      note: row.note ?? undefined,
      uses: row.uses ?? 0,
      maxUses: row.max_uses ?? undefined,
      created: row.created ?? 0,
      redeemers: (byCode.get(row.code) ?? []).sort((a, b) => b.at - a.at),
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
  maxUses?: number,
): Promise<boolean> {
  if (!kvConfigured() || !code.trim()) return false;
  try {
    const r = await sb(CODES, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        code: normalizeCode(code),
        tier,
        note: note?.trim() || null,
        uses: 0,
        max_uses: maxUses && maxUses > 0 ? Math.floor(maxUses) : null,
        created: Date.now(),
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Change a code's device limit without resetting its usage count. */
export async function setCodeLimit(
  code: string,
  maxUses: number | null,
): Promise<boolean> {
  if (!kvConfigured() || !code.trim()) return false;
  try {
    const r = await sb(`${CODES}?code=eq.${encodeURIComponent(code.trim())}`, {
      method: "PATCH",
      body: JSON.stringify({
        max_uses: maxUses && maxUses > 0 ? Math.floor(maxUses) : null,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

interface CodeUseRow {
  code: string;
  name: string | null;
  ip: string | null;
  at: number | null;
}

/** Record who redeemed a code (for the founder's "used by" list). */
export async function recordCodeUse(
  code: string,
  name: string,
  ip: string,
): Promise<void> {
  if (!kvConfigured() || !code.trim()) return;
  try {
    await sb(CODE_USES, {
      method: "POST",
      body: JSON.stringify({
        code: normalizeCode(code),
        name: name || null,
        ip: ip || null,
        at: Date.now(),
      }),
    });
  } catch {
    /* best-effort */
  }
}

export async function listCodeUses(): Promise<
  { code: string; name?: string; ip?: string; at: number }[]
> {
  if (!kvConfigured()) return [];
  try {
    const r = await sb(`${CODE_USES}?select=*&order=at.desc&limit=3000`, {
      method: "GET",
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as CodeUseRow[];
    return rows.map((row) => ({
      code: row.code,
      name: row.name ?? undefined,
      ip: row.ip ?? undefined,
      at: row.at ?? 0,
    }));
  } catch {
    return [];
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

// ---------------------------------------------------------------------------
// Blocklist. A matric number or IP on the list is permanently barred from the
// free trial (paying is unaffected). Used to ban a known fraudster for good.
// ---------------------------------------------------------------------------

export interface BlockRecord {
  value: string;
  type: string; // matric | ip
  reason?: string;
  created: number;
}

interface BlockRow {
  value: string;
  type: string | null;
  reason: string | null;
  created: number | null;
}

/** Is this matric or IP on the blocklist? */
export async function isBlocked(matric: string, ip: string): Promise<boolean> {
  if (!kvConfigured()) return false;
  const values = [normalizeMatric(matric), ip]
    .map((v) => v.trim())
    .filter(Boolean);
  if (values.length === 0) return false;
  try {
    const list = values.map((v) => `"${v.replace(/"/g, "")}"`).join(",");
    const r = await sb(
      `${BLOCKS}?select=value&value=in.(${encodeURIComponent(list)})`,
      { method: "GET" },
    );
    if (!r.ok) return false;
    const rows = (await r.json()) as BlockRow[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function listBlocks(): Promise<BlockRecord[]> {
  if (!kvConfigured()) return [];
  try {
    const r = await sb(`${BLOCKS}?select=*&order=created.desc&limit=1000`, {
      method: "GET",
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as BlockRow[];
    return rows.map((row) => ({
      value: row.value,
      type: row.type ?? "matric",
      reason: row.reason ?? undefined,
      created: row.created ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function addBlock(
  type: "matric" | "ip",
  rawValue: string,
  reason?: string,
): Promise<boolean> {
  if (!kvConfigured() || !rawValue.trim()) return false;
  const value = type === "matric" ? normalizeMatric(rawValue) : rawValue.trim();
  try {
    const r = await sb(BLOCKS, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        value,
        type,
        reason: reason?.trim() || null,
        created: Date.now(),
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function removeBlock(value: string): Promise<boolean> {
  if (!kvConfigured() || !value.trim()) return false;
  try {
    const r = await sb(`${BLOCKS}?value=eq.${encodeURIComponent(value.trim())}`, {
      method: "DELETE",
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Remove a trial record (frees that matric to start a trial again). */
export async function deleteTrial(matric: string): Promise<boolean> {
  if (!kvConfigured() || !matric.trim()) return false;
  try {
    const r = await sb(
      `${TRIALS}?matric=eq.${encodeURIComponent(normalizeMatric(matric))}`,
      { method: "DELETE" },
    );
    return r.ok;
  } catch {
    return false;
  }
}

/** Remove a tracked user record. */
export async function deleteUser(id: string): Promise<boolean> {
  if (!kvConfigured() || !id.trim()) return false;
  try {
    const r = await sb(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return r.ok;
  } catch {
    return false;
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

// Device / fingerprint keys for trials — an extra layer beyond the matric
// block. Stored in an OPTIONAL table (siwes_trial_keys): if it doesn't exist,
// these safely no-op and the matric block still works on its own.
const TRIAL_KEYS = "siwes_trial_keys";

/** True if any of these device/fingerprint keys has started a trial before. */
export async function trialKeyExists(keys: string[]): Promise<boolean> {
  if (!kvConfigured()) return false;
  const clean = keys.map((k) => k.trim()).filter(Boolean);
  if (clean.length === 0) return false;
  try {
    const list = clean.map((k) => `"${k.replace(/"/g, "")}"`).join(",");
    const r = await sb(
      `${TRIAL_KEYS}?select=key&key=in.(${encodeURIComponent(list)})`,
      { method: "GET" },
    );
    if (!r.ok) return false; // table missing / error -> don't block
    const rows = (await r.json()) as { key: string }[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Record device/fingerprint keys for a started trial (best-effort). */
export async function recordTrialKeys(keys: string[]): Promise<void> {
  if (!kvConfigured()) return;
  const clean = keys.map((k) => k.trim()).filter(Boolean);
  if (clean.length === 0) return;
  try {
    await sb(TRIAL_KEYS, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(clean.map((key) => ({ key, at: Date.now() }))),
    });
  } catch {
    /* best-effort */
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

// ---------------------------------------------------------------------------
// Owner-managed Gemini API key pool. Students who don't bring their own key use
// one of these (server-side only, never exposed). The chat route rotates to the
// next key when one hits its quota. An exhausted key auto-recovers after the
// free-tier daily reset window.
// ---------------------------------------------------------------------------

const KEY_COOLDOWN = 24 * 60 * 60 * 1000; // exhausted free key usable again after 24h

interface AiKeyRow {
  id: number;
  key: string | null;
  label: string | null;
  enabled: boolean | null;
  status: string | null; // healthy | exhausted | invalid
  uses: number | null;
  last_used: number | null;
  exhausted_at: number | null;
  created: number | null;
}

export interface AiKeyRecord {
  id: number;
  masked: string;
  label?: string;
  enabled: boolean;
  status: string;
  uses: number;
  lastUsed: number;
  exhaustedAt: number;
}

/** Is at least one usable owner key available (pool or env)? */
export async function hasServerKey(): Promise<boolean> {
  if (process.env.GEMINI_API_KEY) return true;
  if (!kvConfigured()) return false;
  try {
    const r = await sb(`${AI_KEYS}?select=id&enabled=eq.true&limit=1`, {
      method: "GET",
    });
    if (!r.ok) return false;
    const rows = (await r.json()) as AiKeyRow[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Pick the next healthy pool key not already tried this request. */
export async function pickAiKey(
  excludeIds: number[] = [],
): Promise<{ id: number; key: string; uses: number } | null> {
  if (!kvConfigured()) return null;
  try {
    const now = Date.now();
    const r = await sb(
      `${AI_KEYS}?select=*&enabled=eq.true&order=last_used.asc.nullsfirst&limit=50`,
      { method: "GET" },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as AiKeyRow[];
    for (const row of rows) {
      if (excludeIds.includes(row.id) || !row.key) continue;
      const healthy =
        row.status === "healthy" ||
        row.status == null ||
        (row.status === "exhausted" && (row.exhausted_at ?? 0) < now - KEY_COOLDOWN);
      if (healthy) return { id: row.id, key: row.key, uses: row.uses ?? 0 };
    }
    return null;
  } catch {
    return null;
  }
}

export async function markAiKeyStatus(
  id: number,
  status: "healthy" | "exhausted" | "invalid",
): Promise<void> {
  if (!kvConfigured()) return;
  try {
    const patch: Record<string, unknown> = { status };
    if (status === "exhausted") patch.exhausted_at = Date.now();
    await sb(`${AI_KEYS}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  } catch {
    /* best-effort */
  }
}

export async function bumpAiKeyUse(id: number, uses: number): Promise<void> {
  if (!kvConfigured()) return;
  try {
    await sb(`${AI_KEYS}?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ uses: uses + 1, last_used: Date.now(), status: "healthy" }),
    });
  } catch {
    /* best-effort */
  }
}

function maskKey(k: string | null): string {
  if (!k) return "—";
  const s = k.trim();
  return s.length <= 8 ? "••••" : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export async function listAiKeys(): Promise<AiKeyRecord[]> {
  if (!kvConfigured()) return [];
  try {
    const r = await sb(`${AI_KEYS}?select=*&order=created.desc&limit=200`, {
      method: "GET",
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as AiKeyRow[];
    return rows.map((row) => ({
      id: row.id,
      masked: maskKey(row.key),
      label: row.label ?? undefined,
      enabled: row.enabled ?? true,
      status: row.status ?? "healthy",
      uses: row.uses ?? 0,
      lastUsed: row.last_used ?? 0,
      exhaustedAt: row.exhausted_at ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function addAiKey(key: string, label?: string): Promise<boolean> {
  if (!kvConfigured() || !key.trim()) return false;
  try {
    const r = await sb(AI_KEYS, {
      method: "POST",
      body: JSON.stringify({
        key: key.trim(),
        label: label?.trim() || null,
        enabled: true,
        status: "healthy",
        uses: 0,
        created: Date.now(),
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function deleteAiKey(id: number): Promise<boolean> {
  if (!kvConfigured()) return false;
  try {
    const r = await sb(`${AI_KEYS}?id=eq.${id}`, { method: "DELETE" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function setAiKeyEnabled(id: number, enabled: boolean): Promise<boolean> {
  if (!kvConfigured()) return false;
  try {
    const patch: Record<string, unknown> = { enabled };
    if (enabled) patch.status = "healthy"; // re-enabling clears a bad status
    const r = await sb(`${AI_KEYS}?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Per-user daily cap for pooled-key usage. Fails open on any store error. */
export async function checkAndBumpUsage(
  id: string,
  limit: number,
): Promise<{ ok: boolean; count: number }> {
  if (!kvConfigured() || limit <= 0 || !id) return { ok: true, count: 0 };
  const day = new Date().toISOString().slice(0, 10);
  const rowId = `${id}:${day}`;
  try {
    const r = await sb(
      `${USAGE}?select=count&id=eq.${encodeURIComponent(rowId)}`,
      { method: "GET" },
    );
    const rows = r.ok ? ((await r.json()) as { count: number | null }[]) : [];
    const count = rows[0]?.count ?? 0;
    if (count >= limit) return { ok: false, count };
    void sb(USAGE, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: rowId, day, count: count + 1 }),
    }).catch(() => {});
    return { ok: true, count: count + 1 };
  } catch {
    return { ok: true, count: 0 };
  }
}

// ---------------------------------------------------------------------------
// Cloud backup of a student's logbook, keyed by matric number, so their data
// survives switching phones/browsers or clearing history. Best-effort: if the
// store is unavailable it simply no-ops and the app keeps working locally.
// ---------------------------------------------------------------------------

export async function saveBackup(
  matric: string,
  name: string,
  data: string,
): Promise<boolean> {
  if (!kvConfigured() || !matric.trim() || !data) return false;
  try {
    const r = await sb(BACKUPS, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        matric: normalizeMatric(matric),
        name: name || null,
        data,
        updated: Date.now(),
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function loadBackup(
  matric: string,
): Promise<{ data: string; updated: number } | null> {
  if (!kvConfigured() || !matric.trim()) return null;
  try {
    const r = await sb(
      `${BACKUPS}?matric=eq.${encodeURIComponent(normalizeMatric(matric))}&select=data,updated`,
      { method: "GET" },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as { data: string | null; updated: number | null }[];
    const row = rows?.[0];
    if (!row?.data) return null;
    return { data: row.data, updated: row.updated ?? 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// User accounts (email + password). The account row is the source of truth for
// a student's access (tier/kind) and their logbook data, so their work is never
// tied to one browser.
// ---------------------------------------------------------------------------

const ACCOUNTS = "siwes_accounts";

export interface Account {
  /** Matric/registration number — the unique account identity (login field). */
  matric: string;
  name?: string;
  /** Optional — kept for payment receipts only, never used to sign in. */
  email?: string;
  passHash?: string;
  salt?: string;
  tier?: string;
  kind?: string;
  trialExp?: number;
  data?: string;
  /** True until the student sets their own password (after a founder-issued or
   *  reset temporary password). Forces a change on next login. */
  mustReset?: boolean;
  /** Timestamp of a pending "forgot password" request (0/undefined = none). */
  resetRequested?: number;
  created: number;
  lastSeen: number;
}

interface AccountRow {
  matric: string;
  name: string | null;
  email: string | null;
  pass_hash: string | null;
  salt: string | null;
  tier: string | null;
  kind: string | null;
  trial_exp: number | null;
  data: string | null;
  must_reset: boolean | null;
  reset_requested: number | null;
  created: number | null;
  last_seen: number | null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function toAccount(row: AccountRow): Account {
  return {
    matric: row.matric,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    passHash: row.pass_hash ?? undefined,
    salt: row.salt ?? undefined,
    tier: row.tier ?? undefined,
    kind: row.kind ?? undefined,
    trialExp: row.trial_exp ?? undefined,
    data: row.data ?? undefined,
    mustReset: row.must_reset ?? undefined,
    resetRequested: row.reset_requested ?? undefined,
    created: row.created ?? 0,
    lastSeen: row.last_seen ?? 0,
  };
}

/** Look up an account by its matric number (the login identity). */
export async function getAccount(matric: string): Promise<Account | null> {
  if (!kvConfigured() || !matric.trim()) return null;
  try {
    const r = await sb(
      `${ACCOUNTS}?matric=eq.${encodeURIComponent(normalizeMatric(matric))}&select=*`,
      { method: "GET" },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as AccountRow[];
    return rows[0] ? toAccount(rows[0]) : null;
  } catch {
    return null;
  }
}

/** Create a new account keyed by matric. Returns false if it already exists or
 *  on failure. `opts.data` seeds the logbook (e.g. recovered from a matric
 *  backup) and `opts.mustReset` forces a password change on first login (used
 *  when the founder provisions an account with a temporary password). */
export async function createAccount(
  matric: string,
  name: string,
  passHash: string,
  salt: string,
  opts?: {
    email?: string;
    data?: string;
    mustReset?: boolean;
    tier?: string;
    kind?: string;
  },
): Promise<boolean> {
  if (!kvConfigured() || !matric.trim()) return false;
  try {
    const r = await sb(ACCOUNTS, {
      method: "POST",
      body: JSON.stringify({
        matric: normalizeMatric(matric),
        name: name || null,
        email: opts?.email ? normalizeEmail(opts.email) : null,
        pass_hash: passHash,
        salt,
        data: opts?.data ?? null,
        tier: opts?.tier ?? null,
        kind: opts?.kind ?? null,
        must_reset: opts?.mustReset ?? false,
        created: Date.now(),
        last_seen: Date.now(),
      }),
    });
    return r.ok; // 409 (already exists) -> not ok
  } catch {
    return false;
  }
}

export async function updateAccount(
  matric: string,
  patch: Partial<{
    tier: string | null;
    kind: string | null;
    trialExp: number | null;
    email: string;
    name: string;
    data: string;
    passHash: string;
    salt: string;
    mustReset: boolean;
    resetRequested: number | null;
  }>,
): Promise<boolean> {
  if (!kvConfigured() || !matric.trim()) return false;
  const body: Record<string, unknown> = { last_seen: Date.now() };
  if ("tier" in patch) body.tier = patch.tier;
  if ("kind" in patch) body.kind = patch.kind;
  if ("trialExp" in patch) body.trial_exp = patch.trialExp;
  if (patch.email !== undefined) body.email = normalizeEmail(patch.email);
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.data !== undefined) body.data = patch.data;
  if (patch.passHash !== undefined) body.pass_hash = patch.passHash;
  if (patch.salt !== undefined) body.salt = patch.salt;
  if (patch.mustReset !== undefined) body.must_reset = patch.mustReset;
  if ("resetRequested" in patch) body.reset_requested = patch.resetRequested;
  try {
    const r = await sb(
      `${ACCOUNTS}?matric=eq.${encodeURIComponent(normalizeMatric(matric))}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    return r.ok;
  } catch {
    return false;
  }
}

export async function listAccounts(): Promise<Account[]> {
  if (!kvConfigured()) return [];
  try {
    const r = await sb(
      `${ACCOUNTS}?select=matric,name,email,tier,kind,trial_exp,data,must_reset,reset_requested,created,last_seen&order=last_seen.desc&limit=2000`,
      { method: "GET" },
    );
    if (!r.ok) return [];
    const rows = (await r.json()) as AccountRow[];
    return rows.map(toAccount);
  } catch {
    return [];
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
