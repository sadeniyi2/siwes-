import { NextRequest } from "next/server";
import { signAccess, Tier } from "@/lib/token";

export const runtime = "nodejs";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Restore access for someone who already paid but is still locked / on trial
 * (e.g. they paid by transfer/USSD and the in-app callback never completed).
 * They enter the email they paid with; we find their successful Flutterwave
 * transaction and mint the matching paid token. No founder action needed.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret || !process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      { ok: false, message: "Payments are not configured yet." },
      { status: 500 },
    );
  }

  let email = "";
  let name = "";
  try {
    const b = await req.json();
    email = String(b?.email ?? "").trim().toLowerCase();
    name = String(b?.name ?? "").trim().toLowerCase();
  } catch {
    /* ignore */
  }

  if (!email || !email.includes("@")) {
    return Response.json(
      { ok: false, message: "Enter the email you paid with." },
      { status: 400 },
    );
  }

  let list: any[] = [];
  try {
    const res = await fetch(
      "https://api.flutterwave.com/v3/transactions?status=successful",
      { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" },
    );
    const json = await res.json();
    if (json.status !== "success" || !Array.isArray(json.data)) {
      return Response.json(
        { ok: false, message: "Couldn't check payments right now. Please try again." },
        { status: 502 },
      );
    }
    list = json.data;
  } catch {
    return Response.json(
      { ok: false, message: "Couldn't check payments right now. Please try again." },
      { status: 502 },
    );
  }

  // Highest amount matching this email wins (so a Pro payment beats an earlier
  // Basic one). Only our own checkout's transactions count.
  let best: { amount: number; ref: string; email: string } | null = null;
  for (const t of list) {
    const ref = String(t.tx_ref ?? "");
    if (!/^siwes-(basic|pro)-/.test(ref)) continue;
    if (String(t.status ?? "") !== "successful") continue;
    const em = String(t.customer?.email ?? "").trim().toLowerCase();
    const nm = String(t.customer?.name ?? "").trim().toLowerCase();
    const emailMatch = em && em === email;
    const nameMatch = name && nm && nm === name;
    if (!emailMatch && !nameMatch) continue;
    const amount = Number(t.amount ?? 0);
    if (!best || amount > best.amount) {
      best = { amount, ref, email: t.customer?.email ?? email };
    }
  }

  if (!best) {
    return Response.json(
      {
        ok: false,
        message:
          "We couldn't find a completed payment for that email. Please use the exact email you paid with, or contact support.",
      },
      { status: 404 },
    );
  }

  const tier: Tier = best.amount >= 5000 ? "pro" : "basic";
  const token = signAccess({
    email: best.email,
    tier,
    kind: "paid",
    ref: best.ref,
    iat: Date.now(),
  });
  return Response.json({ ok: true, token, tier, email: best.email });
}
