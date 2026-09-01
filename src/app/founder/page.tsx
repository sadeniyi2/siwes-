"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

const TOKEN_KEY = "siwes.founder.token.v1";

interface Sale {
  id: string | number;
  email: string;
  name: string;
  amount: number;
  tier: string;
  date: string;
  ref: string;
}
interface UserRow {
  id: string;
  name?: string;
  email?: string;
  firm?: string;
  kind?: string;
  tier?: string;
  trialExp?: number;
  firstSeen: number;
  lastSeen: number;
}
interface CodeRow {
  code: string;
  tier: string;
  note?: string;
  uses: number;
  maxUses?: number;
  created: number;
  redeemers?: { name?: string; ip?: string; at: number }[];
}
interface TrialRow {
  matric: string;
  ip?: string;
  name?: string;
  started: number;
  exp: number;
  ipCount: number;
}
interface BlockRow {
  value: string;
  type: string;
  reason?: string;
  created: number;
}
interface AiKeyRow {
  id: number;
  masked: string;
  label?: string;
  enabled: boolean;
  status: string;
  uses: number;
  lastUsed: number;
  exhaustedAt: number;
}
interface BackupRow {
  matric: string;
  name?: string;
  updated: number;
  entries: number;
  hasAccount: boolean;
}
interface AccountRow {
  matric: string;
  name: string;
  email: string;
  tier: string | null;
  kind: string | null;
  trialExp: number;
  hasData: boolean;
  mustReset: boolean;
  resetRequested: number;
  created: number;
  lastSeen: number;
}
interface Data {
  admin: string;
  stats: {
    revenue: number;
    salesCount: number;
    basicSales: number;
    proSales: number;
    totalUsers: number;
    trialsTaken: number;
    activeTrials: number;
    expiredTrials: number;
    onlineNow: number;
    accounts: number;
    accountsWithData: number;
    paidAccounts: number;
  };
  sales: Sale[];
  users: UserRow[];
  trials: TrialRow[];
  accounts: AccountRow[];
  tracking: boolean;
  salesError: string | null;
}

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function trialLeft(exp?: number): string {
  if (!exp) return "—";
  const ms = exp - Date.now();
  if (ms <= 0) return "expired";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}
const naira = (n: number) => "₦" + n.toLocaleString();

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl font-bold ${tone ?? "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

export default function FounderPage() {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<
    "sales" | "users" | "accounts" | "trials" | "codes" | "blocks" | "aikeys"
  >("sales");

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
  }, []);

  const load = useCallback(async (tok: string) => {
    try {
      const res = await fetch("/api/founder/data", {
        method: "POST",
        headers: { "x-founder-token": tok },
      });
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setData(null);
        return;
      }
      const j = await res.json();
      if (j.ok) setData(j);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    load(token);
    const t = setInterval(() => load(token), 20000); // refresh every 20s
    return () => clearInterval(t);
  }, [token, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/founder/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, passcode }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        localStorage.setItem(TOKEN_KEY, j.token);
        setToken(j.token);
        setPasscode("");
      } else {
        setError(j.message || "Login failed.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setData(null);
  }

  // ---- Referral codes ----
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newDevices, setNewDevices] = useState("3");
  const [newCodeTier, setNewCodeTier] = useState<"basic" | "pro">("pro");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const codesApi = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!token) return;
      setCodeMsg(null);
      try {
        const res = await fetch("/api/founder/codes", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-founder-token": token },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (j.ok) setCodes(j.codes);
        else setCodeMsg(j.message || "Something went wrong.");
      } catch {
        setCodeMsg("Network error. Please try again.");
      }
    },
    [token],
  );

  useEffect(() => {
    if (token && tab === "codes" && codes === null) codesApi({ action: "list" });
  }, [token, tab, codes, codesApi]);

  // ---- Blocklist ----
  const [blocks, setBlocks] = useState<BlockRow[] | null>(null);
  const [blockValue, setBlockValue] = useState("");
  const [blockType, setBlockType] = useState<"matric" | "ip">("matric");
  const [blockReason, setBlockReason] = useState("");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  const blocksApi = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!token) return;
      setBlockMsg(null);
      try {
        const res = await fetch("/api/founder/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-founder-token": token },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (j.ok) setBlocks(j.blocks);
        else setBlockMsg(j.message || "Something went wrong.");
      } catch {
        setBlockMsg("Network error. Please try again.");
      }
    },
    [token],
  );

  useEffect(() => {
    if (token && tab === "blocks" && blocks === null) blocksApi({ action: "list" });
  }, [token, tab, blocks, blocksApi]);

  // ---- AI key pool ----
  const [aiKeys, setAiKeys] = useState<AiKeyRow[] | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const aiKeysApi = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!token) return;
      setAiMsg(null);
      try {
        const res = await fetch("/api/founder/aikeys", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-founder-token": token },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (j.ok) setAiKeys(j.keys);
        else setAiMsg(j.message || "Something went wrong.");
      } catch {
        setAiMsg("Network error. Please try again.");
      }
    },
    [token],
  );

  useEffect(() => {
    if (token && tab === "aikeys" && aiKeys === null) aiKeysApi({ action: "list" });
  }, [token, tab, aiKeys, aiKeysApi]);

  // Real end-to-end AI check (surfaces the true cause of a chat failure).
  const [aiTest, setAiTest] = useState<{ status: string; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const testAi = useCallback(async () => {
    if (!token) return;
    setTesting(true);
    setAiTest(null);
    try {
      const res = await fetch("/api/founder/aikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-founder-token": token },
        body: JSON.stringify({ action: "test" }),
      });
      const j = await res.json();
      setAiTest(j.test ?? { status: "error", message: "No response from server." });
    } catch {
      setAiTest({ status: "error", message: "Network error. Please try again." });
    } finally {
      setTesting(false);
    }
  }, [token]);

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 6; i++)
      s += chars[Math.floor(Math.random() * chars.length)];
    setNewCode("SIWES-" + s);
  }

  async function copyCode(c: string) {
    try {
      await navigator.clipboard.writeText(c);
      setCopied(c);
      setTimeout(() => setCopied((v) => (v === c ? null : v)), 3000);
    } catch {
      /* ignore */
    }
  }

  // Manually activate a buyer: mint a paid token and copy an activation link
  // to send them (e.g. on WhatsApp). They open it and they're upgraded.
  const [activateInfo, setActivateInfo] = useState<{ who: string; link: string } | null>(null);
  const activate = useCallback(
    async (email: string, name: string, tier: string) => {
      if (!token) return;
      try {
        const res = await fetch("/api/founder/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-founder-token": token },
          body: JSON.stringify({ action: "grant", email, name, tier }),
        });
        const j = await res.json();
        if (!j.ok) return;
        const link = `${window.location.origin}/unlock?access=${encodeURIComponent(j.token)}`;
        try {
          await navigator.clipboard.writeText(link);
        } catch {
          /* clipboard may be blocked; link is still shown */
        }
        setActivateInfo({ who: name || email || "buyer", link });
      } catch {
        /* ignore */
      }
    },
    [token],
  );

  // Remove a duplicate / suspected-fraud record, then refresh.
  const manage = useCallback(
    async (action: string, id: string, confirmMsg: string) => {
      if (!token || !window.confirm(confirmMsg)) return;
      try {
        await fetch("/api/founder/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-founder-token": token },
          body: JSON.stringify({ action, id }),
        });
        load(token);
      } catch {
        /* ignore */
      }
    },
    [token, load],
  );

  // ---- Accounts: provision a login / reset a password ----
  const [acctResult, setAcctResult] = useState<
    { matric: string; tempPassword: string; recovered?: boolean } | null
  >(null);
  const [acctMsg, setAcctMsg] = useState<string | null>(null);
  const [newAcctMatric, setNewAcctMatric] = useState("");
  const [newAcctName, setNewAcctName] = useState("");
  const [newAcctTier, setNewAcctTier] = useState<"" | "basic" | "pro">("");
  const accountsApi = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!token) return;
      setAcctMsg(null);
      try {
        const res = await fetch("/api/founder/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-founder-token": token },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (j.ok && j.tempPassword) {
          setAcctResult({ matric: j.matric, tempPassword: j.tempPassword, recovered: j.recovered });
          load(token);
        } else {
          setAcctMsg(j.message || "Something went wrong.");
        }
      } catch {
        setAcctMsg("Network error. Please try again.");
      }
    },
    [token, load],
  );

  // ---- Recover past logbooks (matric backups) ----
  const [backups, setBackups] = useState<BackupRow[] | null>(null);
  const [bulkResult, setBulkResult] = useState<
    { matric: string; name: string; tempPassword: string; entries: number }[] | null
  >(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const loadBackups = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/founder/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-founder-token": token },
        body: JSON.stringify({ action: "list-backups" }),
      });
      const j = await res.json();
      if (j.ok) setBackups(j.backups);
    } catch {
      /* ignore */
    }
  }, [token]);
  useEffect(() => {
    if (token && tab === "accounts" && backups === null) loadBackups();
  }, [token, tab, backups, loadBackups]);
  const bulkProvision = useCallback(async () => {
    if (!token) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/founder/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-founder-token": token },
        body: JSON.stringify({ action: "bulk-provision" }),
      });
      const j = await res.json();
      if (j.ok) {
        setBulkResult(j.created);
        loadBackups();
        load(token);
      }
    } catch {
      /* ignore */
    } finally {
      setBulkBusy(false);
    }
  }, [token, load, loadBackups]);

  // ---- Login screen ----
  if (!token) {
    return (
      <div className="mx-auto max-w-sm py-10">
        <div className="mb-6 text-center">
          <p className="mb-2 text-4xl">🔐</p>
          <h1 className="font-display text-2xl font-semibold">Founder Panel</h1>
          <p className="text-sm text-ink-soft">Private — authorised access only.</p>
        </div>
        <form
          onSubmit={login}
          className="rounded-2xl border border-ink/10 bg-paper-sheet p-6 shadow-sheet"
        >
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="olive or peace"
            className="mb-3 w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
          />
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Passcode
          </label>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="••••••••"
            className="mb-4 w-full rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
          />
          {error && (
            <p className="mb-3 rounded-xl border border-margin/30 bg-margin/10 px-3 py-2 text-sm text-margin">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  // ---- Dashboard ----
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Founder Panel
          </h1>
          <p className="text-sm text-ink-soft">
            Signed in as {data?.admin ?? "…"} · live overview
          </p>
        </div>
        <button onClick={logout} className="btn-ghost">
          Sign out
        </button>
      </div>

      {!data ? (
        <p className="py-10 text-center text-ink-faint">Loading…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Revenue" value={naira(data.stats.revenue)} tone="text-emerald-600" />
            <Stat label="Sales" value={data.stats.salesCount} />
            <Stat label="Users" value={data.stats.totalUsers} />
            <Stat label="Accounts" value={data.stats.accounts} tone="text-accent" />
            <Stat label="Logbooks saved" value={data.stats.accountsWithData} tone="text-emerald-600" />
            <Stat label="Online now" value={data.stats.onlineNow} tone="text-accent" />
            <Stat label="Trials taken" value={data.stats.trialsTaken} />
            <Stat label="Active trials" value={data.stats.activeTrials} tone="text-accent" />
            <Stat label="Expired trials" value={data.stats.expiredTrials} tone="text-ink-faint" />
            <Stat label="Pro / Basic sold" value={`${data.stats.proSales} / ${data.stats.basicSales}`} />
          </div>

          {data.salesError && (
            <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Sales couldn&apos;t load from Flutterwave. Check FLW_SECRET_KEY is set.
            </p>
          )}
          {!data.tracking && (
            <p className="mb-3 rounded-xl border border-accent/30 bg-accent-wash px-4 py-2.5 text-sm text-accent-deep">
              User &amp; trial tracking is off. Add a free Supabase project
              (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and create the{" "}
              <code className="rounded bg-paper-sheet px-1">siwes_users</code> table to
              see who&apos;s logged in and their trial left. Sales above still work.
            </p>
          )}

          {activateInfo && (
            <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">
                Activation link for {activateInfo.who} — copied to clipboard ✓
              </p>
              <p className="mt-1 break-all font-mono text-xs">{activateInfo.link}</p>
              <p className="mt-1 text-xs text-emerald-800">
                Send this link to the buyer on WhatsApp. When they open it, they
                get Pro instantly.{" "}
                <button
                  onClick={() => setActivateInfo(null)}
                  className="font-medium underline"
                >
                  Dismiss
                </button>
              </p>
            </div>
          )}

          <div className="mb-3 flex gap-1 rounded-full border border-ink/10 bg-paper p-1 text-sm w-fit">
            {(["sales", "users", "accounts", "trials", "codes", "blocks", "aikeys"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 font-medium capitalize transition-all ${
                  tab === t ? "bg-accent text-white shadow-lift" : "text-ink-soft"
                }`}
              >
                {t === "sales"
                  ? "Sales"
                  : t === "users"
                    ? "Users"
                    : t === "accounts"
                      ? "Accounts"
                      : t === "trials"
                        ? "Trials"
                        : t === "codes"
                          ? "Free codes"
                          : t === "blocks"
                            ? "Blocked"
                            : "AI keys"}
              </button>
            ))}
          </div>

          {tab === "accounts" && (
            <div className="mb-3 rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-card">
              <h2 className="font-display text-base font-semibold">
                Create a login for a student
              </h2>
              <p className="mb-3 mt-0.5 text-sm text-ink-soft">
                Enter their matric number. If that matric has a saved backup, their
                logbook is restored into the account automatically. You&apos;ll get a
                temporary password to send them — they set their own on first login.
              </p>
              <div className="grid gap-2 sm:grid-cols-4">
                <input
                  value={newAcctMatric}
                  onChange={(e) => setNewAcctMatric(e.target.value)}
                  placeholder="Matric / Reg no."
                  className="rounded-xl border border-ink/15 bg-paper-sheet px-3 py-2 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <input
                  value={newAcctName}
                  onChange={(e) => setNewAcctName(e.target.value)}
                  placeholder="Name (optional)"
                  className="rounded-xl border border-ink/15 bg-paper-sheet px-3 py-2 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <select
                  value={newAcctTier}
                  onChange={(e) => setNewAcctTier(e.target.value as "" | "basic" | "pro")}
                  className="rounded-xl border border-ink/15 bg-paper-sheet px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  <option value="">No plan yet</option>
                  <option value="basic">Give Basic</option>
                  <option value="pro">Give Pro</option>
                </select>
                <button
                  onClick={() => {
                    if (newAcctMatric.trim().length < 4) {
                      setAcctMsg("Enter a valid matric number.");
                      return;
                    }
                    accountsApi({
                      action: "create-account",
                      matric: newAcctMatric.trim(),
                      name: newAcctName.trim(),
                      tier: newAcctTier || undefined,
                    });
                    setNewAcctMatric("");
                    setNewAcctName("");
                    setNewAcctTier("");
                  }}
                  className="btn-primary py-2"
                >
                  Create login
                </button>
              </div>
              {acctResult && (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <p className="font-medium">
                    Login ready for <span className="font-mono">{acctResult.matric}</span>
                  </p>
                  <p className="mt-1">
                    Temporary password:{" "}
                    <span className="select-all rounded bg-ink/10 px-1.5 py-0.5 font-mono font-semibold">
                      {acctResult.tempPassword}
                    </span>{" "}
                    <button
                      onClick={() =>
                        navigator.clipboard
                          ?.writeText(acctResult.tempPassword)
                          .catch(() => {})
                      }
                      className="ml-1 text-xs font-medium text-accent-dark hover:underline"
                    >
                      Copy
                    </button>
                  </p>
                  <p className="mt-1 text-ink-soft">
                    Send them their matric + this password. They&apos;ll be asked to set
                    their own password on first login.
                    {acctResult.recovered
                      ? " Their previous logbook was found and restored ✓"
                      : ""}
                  </p>
                </div>
              )}
              {acctMsg && (
                <p className="mt-3 rounded-xl border border-margin/30 bg-margin/10 px-3 py-2 text-sm text-margin">
                  {acctMsg}
                </p>
              )}
            </div>
          )}

          {tab === "accounts" && (
            <div className="mb-3 rounded-2xl border border-ink/10 bg-paper-sheet p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold">
                    Recover past logbooks
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Students whose logbook was backed up (by matric) before accounts
                    existed. Give them all a login in one click — each keeps their data.
                  </p>
                </div>
                {backups && backups.some((b) => !b.hasAccount) && (
                  <button
                    onClick={bulkProvision}
                    disabled={bulkBusy}
                    className="btn-primary py-2 disabled:opacity-60"
                  >
                    {bulkBusy
                      ? "Creating…"
                      : `Create logins for all ${backups.filter((b) => !b.hasAccount).length} recoverable`}
                  </button>
                )}
              </div>

              {bulkResult && bulkResult.length > 0 && (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="mb-2 text-sm font-medium">
                    Created {bulkResult.length} login{bulkResult.length === 1 ? "" : "s"}.
                    Send each student their matric + temporary password:
                  </p>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {bulkResult.map((r) => (
                          <tr key={r.matric} className="border-b border-ink/5">
                            <td className="py-1.5 pr-2 font-mono">{r.matric}</td>
                            <td className="py-1.5 pr-2 text-ink-soft">{r.name || "—"}</td>
                            <td className="py-1.5 pr-2">
                              <span className="select-all rounded bg-ink/10 px-1.5 py-0.5 font-mono font-semibold">
                                {r.tempPassword}
                              </span>
                            </td>
                            <td className="py-1.5 text-xs text-ink-faint">
                              {r.entries} {r.entries === 1 ? "entry" : "entries"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(
                          bulkResult
                            .map((r) => `${r.matric}\t${r.name}\t${r.tempPassword}`)
                            .join("\n"),
                        )
                        .catch(() => {})
                    }
                    className="btn-ghost mt-2 py-1.5 text-xs"
                  >
                    ⧉ Copy all as a list
                  </button>
                </div>
              )}

              {backups === null ? (
                <p className="mt-3 text-sm text-ink-faint">Loading backups…</p>
              ) : backups.length === 0 ? (
                <p className="mt-3 text-sm text-ink-faint">
                  No matric backups found. (Only students who used the app while cloud
                  backup was on will appear here.)
                </p>
              ) : (
                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-ink/10">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                        <th className="px-3 py-2">Matric</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Entries</th>
                        <th className="px-3 py-2">Backed up</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((b) => (
                        <tr key={b.matric} className="border-b border-ink/5">
                          <td className="px-3 py-2 font-mono">{b.matric}</td>
                          <td className="px-3 py-2 text-ink-soft">{b.name || "—"}</td>
                          <td className="px-3 py-2">{b.entries}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-ink-soft">
                            {b.updated ? timeAgo(b.updated) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {b.hasAccount ? (
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                                has login
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  accountsApi({
                                    action: "create-account",
                                    matric: b.matric,
                                    name: b.name || "",
                                  })
                                }
                                className="text-xs font-medium text-accent-dark hover:underline"
                              >
                                Create login
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab !== "codes" && tab !== "blocks" && tab !== "aikeys" && (
          <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper-sheet shadow-card">
            {tab === "sales" ? (
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                        No sales yet.
                      </td>
                    </tr>
                  )}
                  {data.sales.map((s) => (
                    <tr key={String(s.id)} className="border-b border-ink/5">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                        {new Date(s.date).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.name || "—"}</p>
                        <p className="text-xs text-ink-faint">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">{s.tier}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">
                        {naira(s.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <button
                          onClick={() => activate(s.email, s.name, s.tier)}
                          title="Mint a Pro activation link to send this buyer"
                          className="text-xs font-medium text-accent-dark hover:underline"
                        >
                          Activate →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : tab === "users" ? (
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Trial left</th>
                    <th className="px-4 py-3">Last seen</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                        No users tracked yet.
                      </td>
                    </tr>
                  )}
                  {data.users.map((u) => {
                    const online = Date.now() - u.lastSeen < 5 * 60 * 1000;
                    return (
                      <tr key={u.id} className="border-b border-ink/5">
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-1.5 font-medium">
                            {online && (
                              <span className="h-2 w-2 rounded-full bg-emerald-500" title="online" />
                            )}
                            {u.name || "Anonymous"}
                          </p>
                          <p className="text-xs text-ink-faint">
                            {u.email || u.firm || u.id.slice(0, 10)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize">{u.kind ?? "—"}</span>
                          {u.tier ? (
                            <span className="text-ink-faint"> · {u.tier}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              u.kind === "trial"
                                ? trialLeft(u.trialExp) === "expired"
                                  ? "text-margin"
                                  : "text-accent-dark"
                                : "text-ink-faint"
                            }
                          >
                            {u.kind === "trial" ? trialLeft(u.trialExp) : "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                          {timeAgo(u.lastSeen)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              manage(
                                "delete-user",
                                u.id,
                                `Remove ${u.name || "this user"} from your monitoring list? This only deletes the tracking record, not their access.`,
                              )
                            }
                            className="text-xs font-medium text-margin hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : tab === "trials" ? (
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3">Matric no.</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">IP address</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Trial left</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.trials.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
                        No trials taken yet.
                      </td>
                    </tr>
                  )}
                  {data.trials.map((t) => {
                    const expired = t.exp <= Date.now();
                    const flagged = t.ipCount >= 3;
                    return (
                      <tr
                        key={t.matric}
                        className={`border-b border-ink/5 ${
                          flagged ? "bg-amber-400/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-medium">
                          {t.matric}
                        </td>
                        <td className="px-4 py-3">{t.name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs">{t.ip || "—"}</span>
                          {t.ipCount > 1 && (
                            <span
                              className={`ml-1.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                flagged
                                  ? "bg-margin/15 text-margin"
                                  : "bg-ink/10 text-ink-soft"
                              }`}
                              title="Number of trials started from this IP"
                            >
                              {t.ipCount}× this IP
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                          {timeAgo(t.started)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={expired ? "text-margin" : "text-accent-dark"}>
                            {expired ? "expired" : trialLeft(t.exp)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Block matric ${t.matric} from ALL future trials? (Paying still works.)`,
                                )
                              )
                                blocksApi({
                                  action: "add",
                                  type: "matric",
                                  value: t.matric,
                                  reason: t.name || "",
                                });
                            }}
                            className="text-xs font-medium text-accent-dark hover:underline"
                          >
                            Block
                          </button>
                          {t.ip && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Block IP ${t.ip} from ALL future trials? Note: campus/mobile networks share IPs, so this can affect other students.`,
                                  )
                                )
                                  blocksApi({
                                    action: "add",
                                    type: "ip",
                                    value: t.ip,
                                    reason: `from ${t.matric}`,
                                  });
                              }}
                              className="ml-2 text-xs font-medium text-accent-dark hover:underline"
                            >
                              Block IP
                            </button>
                          )}
                          <button
                            onClick={() =>
                              manage(
                                "delete-trial",
                                t.matric,
                                `Delete the trial record for ${t.matric}? This removes it from the list and lets that matric number start a fresh trial. Only do this for a duplicate or a mistake.`,
                              )
                            }
                            className="ml-2 text-xs font-medium text-margin hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : tab === "accounts" ? (
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Logbook</th>
                    <th className="px-4 py-3">Last seen</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                        No accounts yet. Students appear here once they sign up.
                      </td>
                    </tr>
                  )}
                  {data.accounts.map((a) => {
                    const online = Date.now() - a.lastSeen < 5 * 60 * 1000;
                    return (
                      <tr
                        key={a.matric}
                        className={`border-b border-ink/5 ${
                          a.resetRequested ? "bg-amber-400/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-1.5 font-medium">
                            {online && (
                              <span className="h-2 w-2 rounded-full bg-emerald-500" title="online" />
                            )}
                            {a.name || "—"}
                          </p>
                          <p className="font-mono text-[11px] text-ink-faint">{a.matric}</p>
                          {a.email && (
                            <p className="text-xs text-ink-faint">{a.email}</p>
                          )}
                          {a.resetRequested > 0 && (
                            <span className="mt-0.5 inline-block rounded-full bg-margin/15 px-1.5 py-0.5 text-[10px] font-semibold text-margin">
                              password reset requested
                            </span>
                          )}
                          {a.mustReset && (
                            <span className="ml-1 mt-0.5 inline-block rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                              temp password
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.tier ? (
                            <span>
                              <span className="capitalize">{a.kind ?? "paid"}</span>
                              <span className="text-ink-faint"> · {a.tier}</span>
                              {a.kind === "trial" && (
                                <span className="block text-xs text-ink-faint">
                                  {trialLeft(a.trialExp)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-ink-faint">no plan</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.hasData ? (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                              saved
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                          {timeAgo(a.lastSeen)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Reset the password for ${a.matric}? They'll get a temporary password and must set a new one on next login.`,
                                )
                              )
                                accountsApi({ action: "reset-password", matric: a.matric });
                            }}
                            className="text-xs font-medium text-accent-dark hover:underline"
                          >
                            Reset password
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
          )}

          {tab === "codes" && (
            <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">
                Free access codes
              </h2>
              <p className="mb-4 mt-0.5 text-sm text-ink-soft">
                Share a code with anyone you want to give free access. They enter
                it in the <span className="font-medium">Access code</span> box on
                signup (or on their profile) and get in — no payment. The box
                never says &quot;free&quot;.
              </p>

              {!data.tracking && (
                <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  Connect Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and
                  create the{" "}
                  <code className="rounded bg-paper-sheet px-1">siwes_codes</code>{" "}
                  table to create codes here. Codes set in the REFERRAL_CODES env
                  var still work and show below.
                </p>
              )}

              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="CODE (e.g. SIWES-AB12CD)"
                  className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Note (who it's for) — optional"
                  className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <select
                  value={newCodeTier}
                  onChange={(e) => setNewCodeTier(e.target.value as "basic" | "pro")}
                  title="What this code unlocks"
                  className="shrink-0 rounded-xl border border-ink/15 bg-paper-sheet px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="pro">Grants Pro</option>
                  <option value="basic">Grants Basic</option>
                </select>
                <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-ink/15 bg-paper-sheet px-3 py-2.5 text-sm">
                  <span className="whitespace-nowrap text-ink-faint">Devices</span>
                  <input
                    type="number"
                    min={1}
                    value={newDevices}
                    onChange={(e) => setNewDevices(e.target.value)}
                    className="w-14 bg-transparent text-center outline-none"
                    title="How many devices can redeem this code"
                  />
                </label>
                <button
                  onClick={randomCode}
                  className="btn-ghost shrink-0"
                  type="button"
                >
                  🎲 Generate
                </button>
                <button
                  onClick={() => {
                    const c = newCode.trim();
                    if (!c) return;
                    const devices = Math.max(1, Math.floor(Number(newDevices) || 1));
                    codesApi({
                      action: "add",
                      code: c,
                      tier: newCodeTier,
                      note: newNote,
                      maxUses: devices,
                    });
                    setNewCode("");
                    setNewNote("");
                    setNewDevices("3");
                  }}
                  disabled={!newCode.trim() || !data.tracking}
                  className="btn-primary shrink-0 disabled:opacity-50"
                  type="button"
                >
                  Create code
                </button>
              </div>

              {codeMsg && (
                <p className="mb-3 rounded-xl border border-margin/30 bg-margin/10 px-3 py-2 text-sm text-margin">
                  {codeMsg}
                </p>
              )}

              <div className="overflow-x-auto rounded-xl border border-ink/10">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Grants</th>
                      <th className="px-4 py-3">Used / devices</th>
                      <th className="px-4 py-3">Note</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes === null && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {codes?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                          No codes yet. Create one above.
                        </td>
                      </tr>
                    )}
                    {codes?.map((c) => {
                      const fromEnv = c.created === 0;
                      const redeemers = c.redeemers ?? [];
                      const expanded = expandedCode === c.code;
                      const exhausted = c.maxUses != null && c.uses >= c.maxUses;
                      return (
                        <Fragment key={c.code}>
                        <tr
                          className={`border-b border-ink/5 ${
                            fromEnv ? "" : "cursor-pointer hover:bg-ink/[0.02]"
                          }`}
                          onClick={() =>
                            !fromEnv && setExpandedCode(expanded ? null : c.code)
                          }
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-semibold text-accent-dark">
                              {c.code}
                            </span>
                            {!fromEnv && (
                              <span className="ml-1.5 text-[10px] text-ink-faint">
                                {expanded ? "▾" : "▸"}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyCode(c.code);
                              }}
                              title="Copy code"
                              className="ml-2 text-xs text-ink-faint hover:text-accent-dark"
                            >
                              📋
                            </button>
                            {copied === c.code && (
                              <span className="ml-1 text-xs text-emerald-600">
                                copied ✓
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 capitalize">{c.tier}</td>
                          <td className="px-4 py-3 text-ink-soft">
                            <span className={exhausted ? "font-semibold text-margin" : ""}>
                              {c.uses}
                              {c.maxUses != null ? ` / ${c.maxUses}` : " / ∞"}
                            </span>
                            {redeemers.length > 0 && (
                              <span className="ml-1.5 text-xs text-accent-dark">
                                · {redeemers.length} user
                                {redeemers.length === 1 ? "" : "s"}
                              </span>
                            )}
                            {exhausted && (
                              <span className="ml-1.5 text-[10px] font-semibold uppercase text-margin">
                                full
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-ink-faint">
                            {fromEnv ? "from environment" : c.note || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {!fromEnv && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const val = window.prompt(
                                      "How many devices can use this code? (leave blank for unlimited)",
                                      c.maxUses != null ? String(c.maxUses) : "",
                                    );
                                    if (val === null) return;
                                    const n =
                                      val.trim() === ""
                                        ? 0
                                        : Math.max(0, Math.floor(Number(val) || 0));
                                    codesApi({ action: "setlimit", code: c.code, maxUses: n });
                                  }}
                                  className="text-xs font-medium text-accent-dark hover:underline"
                                >
                                  Limit
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    codesApi({ action: "delete", code: c.code });
                                  }}
                                  className="ml-2 text-xs font-medium text-margin hover:underline"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-ink/5 bg-ink/[0.02]">
                            <td colSpan={5} className="px-4 py-2.5">
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                                Used by {redeemers.length > 0 ? `(${redeemers.length})` : ""}
                              </p>
                              {redeemers.length === 0 ? (
                                c.uses > 0 ? (
                                  <p className="text-xs text-ink-faint">
                                    Used {c.uses} time{c.uses === 1 ? "" : "s"}, but
                                    names weren&apos;t captured. Create the{" "}
                                    <code className="rounded bg-ink/10 px-1">siwes_code_uses</code>{" "}
                                    table in Supabase to record who uses it from now on.
                                  </p>
                                ) : (
                                  <p className="text-xs text-ink-faint">
                                    No one has used this code yet.
                                  </p>
                                )
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {redeemers.map((u, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="text-ink">
                                        {u.name || "Unnamed"}
                                        {u.ip ? (
                                          <span className="ml-1.5 font-mono text-ink-faint">
                                            {u.ip}
                                          </span>
                                        ) : null}
                                      </span>
                                      <span className="text-ink-faint">{timeAgo(u.at)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "blocks" && (
            <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">
                Blocklist
              </h2>
              <p className="mb-4 mt-0.5 text-sm text-ink-soft">
                A blocked matric number or IP can never start a free trial
                (paying still works). Use the <strong>Block</strong> buttons on
                the Trials tab, or add one manually below.
              </p>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <select
                  value={blockType}
                  onChange={(e) => setBlockType(e.target.value as "matric" | "ip")}
                  className="rounded-xl border border-ink/15 bg-paper-sheet px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="matric">Matric no.</option>
                  <option value="ip">IP address</option>
                </select>
                <input
                  value={blockValue}
                  onChange={(e) => setBlockValue(e.target.value)}
                  placeholder={blockType === "matric" ? "e.g. 20/52HA093" : "e.g. 102.89.x.x"}
                  className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <button
                  onClick={() => {
                    if (!blockValue.trim()) return;
                    blocksApi({
                      action: "add",
                      type: blockType,
                      value: blockValue,
                      reason: blockReason,
                    });
                    setBlockValue("");
                    setBlockReason("");
                  }}
                  disabled={!blockValue.trim()}
                  className="btn-primary shrink-0 disabled:opacity-50"
                  type="button"
                >
                  Block
                </button>
              </div>

              {blockMsg && (
                <p className="mb-3 rounded-xl border border-margin/30 bg-margin/10 px-3 py-2 text-sm text-margin">
                  {blockMsg}
                </p>
              )}

              <div className="overflow-x-auto rounded-xl border border-ink/10">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                      <th className="px-4 py-3">Blocked value</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks === null && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {blocks?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
                          Nothing blocked. Add one above or from the Trials tab.
                        </td>
                      </tr>
                    )}
                    {blocks?.map((b) => (
                      <tr key={b.value} className="border-b border-ink/5">
                        <td className="px-4 py-3 font-mono font-medium">{b.value}</td>
                        <td className="px-4 py-3 uppercase text-ink-soft">{b.type}</td>
                        <td className="px-4 py-3 text-ink-faint">{b.reason || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() =>
                              blocksApi({ action: "remove", value: b.value })
                            }
                            className="text-xs font-medium text-accent-dark hover:underline"
                          >
                            Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "aikeys" && (
            <div className="rounded-2xl border border-ink/10 bg-paper-sheet p-5 shadow-card">
              <h2 className="font-display text-base font-semibold">
                Shared AI keys
              </h2>
              <p className="mb-4 mt-0.5 text-sm text-ink-soft">
                Add your own free Gemini keys here so students don&apos;t have to.
                The app uses a healthy key automatically and switches to the next
                one when a key hits its daily limit (exhausted keys recover after
                24h). Keys stay private — students never see them. Get keys free
                at{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  aistudio.google.com/apikey
                </a>
                .
              </p>

              <div className="mb-4 rounded-xl border border-ink/10 bg-paper p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">Chat not working for students?</span>{" "}
                    Run a live test — it shows the real reason.
                  </p>
                  <button
                    onClick={testAi}
                    disabled={testing}
                    className="btn-primary py-2 disabled:opacity-60"
                  >
                    {testing ? "Testing…" : "Test the AI now"}
                  </button>
                </div>
                {aiTest && (
                  <div
                    className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                      aiTest.status === "ok"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        : "border-margin/30 bg-margin/10 text-margin"
                    }`}
                  >
                    <p className="font-medium">
                      {aiTest.status === "ok"
                        ? "AI is working ✓"
                        : aiTest.status === "no_key"
                          ? "No usable key"
                          : "AI test failed"}
                    </p>
                    <p className="mt-0.5 break-words">{aiTest.message}</p>
                    {aiTest.status !== "ok" && (
                      <p className="mt-1 text-xs text-ink-soft">
                        Common fixes: make sure a key&apos;s toggle is ON below; if it
                        says the key was rejected, the key is wrong or its Gemini API
                        isn&apos;t enabled; if it mentions quota, all keys are at their
                        daily limit (add another).
                      </p>
                    )}
                  </div>
                )}
              </div>

              {!data.tracking && (
                <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                  Connect Supabase and create the{" "}
                  <code className="rounded bg-paper-sheet px-1">siwes_ai_keys</code>{" "}
                  table to manage keys here.
                </p>
              )}

              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Paste a Gemini API key (AIza…)"
                  className="min-w-0 flex-[2] rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <input
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Label (e.g. Olive's key) — optional"
                  className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper-sheet px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
                />
                <button
                  onClick={() => {
                    if (!newKey.trim()) return;
                    aiKeysApi({ action: "add", key: newKey, label: newKeyLabel });
                    setNewKey("");
                    setNewKeyLabel("");
                  }}
                  disabled={!newKey.trim() || !data.tracking}
                  className="btn-primary shrink-0 disabled:opacity-50"
                  type="button"
                >
                  Add key
                </button>
              </div>

              {aiMsg && (
                <p className="mb-3 rounded-xl border border-margin/30 bg-margin/10 px-3 py-2 text-sm text-margin">
                  {aiMsg}
                </p>
              )}

              <div className="overflow-x-auto rounded-xl border border-ink/10">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                      <th className="px-4 py-3">Key</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Used</th>
                      <th className="px-4 py-3">Last used</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiKeys === null && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {aiKeys?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-ink-faint">
                          No shared keys yet. Add one above and students stop
                          being asked for a key.
                        </td>
                      </tr>
                    )}
                    {aiKeys?.map((k) => {
                      const badge = !k.enabled
                        ? "bg-ink/10 text-ink-faint"
                        : k.status === "exhausted"
                          ? "bg-amber-400/15 text-amber-700"
                          : k.status === "invalid"
                            ? "bg-margin/15 text-margin"
                            : "bg-emerald-100 text-emerald-700";
                      const label = !k.enabled ? "disabled" : k.status;
                      return (
                        <tr key={k.id} className="border-b border-ink/5">
                          <td className="px-4 py-3">
                            <span className="font-mono">{k.masked}</span>
                            {k.label && (
                              <span className="ml-2 text-xs text-ink-faint">
                                {k.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${badge}`}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-ink-soft">{k.uses}×</td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                            {k.lastUsed ? timeAgo(k.lastUsed) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <button
                              onClick={() =>
                                aiKeysApi({ action: "toggle", id: k.id, enabled: !k.enabled })
                              }
                              className="text-xs font-medium text-accent-dark hover:underline"
                            >
                              {k.enabled ? "Disable" : "Enable"}
                            </button>
                            <button
                              onClick={() => aiKeysApi({ action: "delete", id: k.id })}
                              className="ml-2 text-xs font-medium text-margin hover:underline"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-ink-faint">
            Auto-refreshes every 20 seconds.
          </p>
        </>
      )}
    </div>
  );
}
