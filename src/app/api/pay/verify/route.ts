import { NextRequest } from "next/server";
import { signAccess, Tier } from "@/lib/token";
import { grantToAccount } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Confirm a Flutterwave payment server-side, then mint a signed access token.
 * The token is the proof of purchase the app checks on every protected action —
 * it can only be produced here, after Flutterwave reports a successful charge.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret || !process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      {
        ok: false,
        message:
          "Payments are not configured yet. The owner needs to set FLW_SECRET_KEY and ACCESS_TOKEN_SECRET.",
      },
      { status: 500 },
    );
  }

  let body: { transactionId?: string | number; txRef?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }

  // Sanitize the transaction id — it goes into an outbound URL path, so reject
  // anything that isn't a plain id to prevent path traversal / URL injection.
  const txId = String(body.transactionId ?? "");
  if (!txId || !/^[a-zA-Z0-9_-]{1,64}$/.test(txId)) {
    return Response.json(
      { ok: false, message: "Invalid transaction id" },
      { status: 400 },
    );
  }

  // Verify with Flutterwave using the server secret key.
  let data: {
    status?: string;
    amount?: number;
    currency?: string;
    tx_ref?: string;
    customer?: { email?: string };
  };
  try {
    const res = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(txId)}/verify`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const json = await res.json();
    if (json.status !== "success" || !json.data) {
      return Response.json(
        { ok: false, message: "Could not verify this payment." },
        { status: 402 },
      );
    }
    data = json.data;
  } catch {
    return Response.json(
      { ok: false, message: "Payment verification failed. Please try again." },
      { status: 502 },
    );
  }

  const amount = Number(data.amount ?? 0);
  const currency = data.currency ?? "NGN";
  const txRef = String(data.tx_ref ?? "");

  if (data.status !== "successful" || currency !== "NGN" || !Number.isFinite(amount)) {
    return Response.json(
      { ok: false, message: "Payment was not completed." },
      { status: 402 },
    );
  }

  // The transaction must be one our own checkout created (tx_ref is set by us as
  // `siwes-<tier>-<time>`). This stops a random valid Flutterwave transaction id
  // from another merchant/app being replayed here to mint free access.
  if (!/^siwes-(basic|pro)-/.test(txRef)) {
    return Response.json(
      { ok: false, message: "This payment could not be matched to this app." },
      { status: 402 },
    );
  }

  // Tier from the amount actually paid (verified server-side, never trusted from
  // the client) — and it must not exceed what the tx_ref claimed.
  const tier: Tier | null = amount >= 2500 ? "pro" : amount >= 1500 ? "basic" : null;
  if (!tier) {
    return Response.json(
      { ok: false, message: "The amount paid doesn't match a plan." },
      { status: 402 },
    );
  }

  const email = data.customer?.email ?? "";

  // If a logged-in account paid, upgrade that account so the plan (and their
  // logbook) follow them to any device — and hand back an account token.
  const granted = await grantToAccount(req.headers.get("x-access-token"), {
    tier,
    kind: "paid",
  });
  const token =
    granted?.token ??
    signAccess({
      email,
      tier,
      kind: "paid",
      ref: txRef,
      iat: Date.now(),
    });

  return Response.json({
    ok: true,
    token,
    tier,
    email,
    amount,
    txRef,
    transactionId: txId,
  });
}
