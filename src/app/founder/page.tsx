"use client";

import { useCallback, useEffect, useState } from "react";

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
interface Data {
  admin: string;
  stats: {
    revenue: number;
    salesCount: number;
    basicSales: number;
    proSales: number;
    totalUsers: number;
    activeTrials: number;
    expiredTrials: number;
    onlineNow: number;
  };
  sales: Sale[];
  users: UserRow[];
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
  const [tab, setTab] = useState<"sales" | "users">("sales");

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
            className="mb-3 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
          />
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Passcode
          </label>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="••••••••"
            className="mb-4 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-accent focus:shadow-glow"
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
            <Stat label="Online now" value={data.stats.onlineNow} tone="text-accent" />
            <Stat label="Basic sold" value={data.stats.basicSales} />
            <Stat label="Pro sold" value={data.stats.proSales} />
            <Stat label="Active trials" value={data.stats.activeTrials} tone="text-accent" />
            <Stat label="Expired trials" value={data.stats.expiredTrials} tone="text-ink-faint" />
          </div>

          {data.salesError && (
            <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Sales couldn&apos;t load from Flutterwave. Check FLW_SECRET_KEY is set.
            </p>
          )}
          {!data.tracking && (
            <p className="mb-3 rounded-xl border border-accent/30 bg-accent-wash px-4 py-2.5 text-sm text-accent-deep">
              User &amp; trial tracking is off. Add a free Upstash Redis
              (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) to see who&apos;s
              logged in and their trial left. Sales above still work.
            </p>
          )}

          <div className="mb-3 flex gap-1 rounded-full border border-ink/10 bg-paper p-1 text-sm w-fit">
            {(["sales", "users"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-1.5 font-medium capitalize transition-all ${
                  tab === t ? "bg-accent text-white shadow-lift" : "text-ink-soft"
                }`}
              >
                {t === "sales" ? "Sales" : "Users & trials"}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-paper-sheet shadow-card">
            {tab === "sales" ? (
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wider text-ink-faint">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Trial left</th>
                    <th className="px-4 py-3">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-ink-faint">
            Auto-refreshes every 20 seconds.
          </p>
        </>
      )}
    </div>
  );
}
