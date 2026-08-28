import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { kvConfigured, listAccounts, listTrials, listUsers } from "@/lib/kv";

export const runtime = "nodejs";

interface Sale {
  id: string | number;
  email: string;
  name: string;
  amount: number;
  tier: "basic" | "pro" | "other";
  date: string;
  ref: string;
}

async function fetchSales(): Promise<{ sales: Sale[]; error?: string }> {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) return { sales: [], error: "no_flw_key" };
  try {
    const res = await fetch(
      "https://api.flutterwave.com/v3/transactions?status=successful",
      { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
    );
    const json = await res.json();
    if (json.status !== "success" || !Array.isArray(json.data)) {
      return { sales: [], error: "flw_error" };
    }
    const sales: Sale[] = json.data
      .filter((t: { tx_ref?: string }) =>
        String(t.tx_ref ?? "").startsWith("siwes-"),
      )
      .map((t: {
        id: string | number;
        amount: number;
        customer?: { email?: string; name?: string };
        created_at: string;
        tx_ref: string;
      }) => {
        const amt = Number(t.amount ?? 0);
        return {
          id: t.id,
          email: t.customer?.email ?? "",
          name: t.customer?.name ?? "",
          amount: amt,
          tier: amt >= 2500 ? "pro" : amt >= 1500 ? "basic" : "other",
          date: t.created_at,
          ref: t.tx_ref,
        } as Sale;
      });
    return { sales };
  } catch {
    return { sales: [], error: "flw_error" };
  }
}

export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-founder-token"));
  if (!claims || claims.role !== "admin") {
    return Response.json({ ok: false }, { status: 401 });
  }

  const [{ sales, error }, users, trials, accounts] = await Promise.all([
    fetchSales(),
    listUsers(),
    listTrials(),
    listAccounts(),
  ]);

  // Group trials by IP to surface possible abuse (many trials, one network).
  const ipCounts = new Map<string, number>();
  for (const t of trials) {
    if (t.ip) ipCounts.set(t.ip, (ipCounts.get(t.ip) ?? 0) + 1);
  }

  const now = Date.now();
  const revenue = sales.reduce((n, s) => n + s.amount, 0);
  const stats = {
    revenue,
    salesCount: sales.length,
    basicSales: sales.filter((s) => s.tier === "basic").length,
    proSales: sales.filter((s) => s.tier === "pro").length,
    totalUsers: users.length,
    trialsTaken: trials.length,
    activeTrials: trials.filter((t) => t.exp > now).length,
    expiredTrials: trials.filter((t) => t.exp > 0 && t.exp <= now).length,
    onlineNow: users.filter((u) => now - u.lastSeen < 5 * 60 * 1000).length,
    accounts: accounts.length,
    accountsWithData: accounts.filter((a) => !!a.data).length,
    paidAccounts: accounts.filter((a) => a.tier === "basic" || a.tier === "pro").length,
  };

  return Response.json({
    ok: true,
    admin: claims.name,
    stats,
    sales: sales.sort((a, b) => (a.date < b.date ? 1 : -1)),
    users: users.sort((a, b) => b.lastSeen - a.lastSeen),
    trials: trials.map((t) => ({ ...t, ipCount: t.ip ? ipCounts.get(t.ip) ?? 1 : 0 })),
    accounts: accounts.map((a) => ({
      matric: a.matric,
      name: a.name ?? "",
      email: a.email ?? "",
      tier: a.tier ?? null,
      kind: a.kind ?? null,
      trialExp: a.trialExp ?? 0,
      hasData: !!a.data,
      mustReset: !!a.mustReset,
      resetRequested: a.resetRequested ?? 0,
      created: a.created,
      lastSeen: a.lastSeen,
    })),
    tracking: kvConfigured(),
    salesError: error ?? null,
  });
}
