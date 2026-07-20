import { NextRequest } from "next/server";
import { signAccess, Tier } from "@/lib/token";

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

  if (!body.transactionId) {
    return Response.json(
      { ok: false, message: "Missing transaction id" },
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
      `https://api.flutterwave.com/v3/transactions/${body.transactionId}/verify`,
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

  if (data.status !== "successful" || currency !== "NGN") {
    return Response.json(
      { ok: false, message: "Payment was not completed." },
      { status: 402 },
    );
  }

  // Tier from the amount actually paid.
  const tier: Tier | null = amount >= 5000 ? "pro" : amount >= 3000 ? "basic" : null;
  if (!tier) {
    return Response.json(
      { ok: false, message: "The amount paid doesn't match a plan." },
      { status: 402 },
    );
  }

  const email = data.customer?.email ?? "";
  const token = signAccess({
    email,
    tier,
    ref: String(data.tx_ref ?? body.transactionId),
    iat: Date.now(),
  });

  return Response.json({ ok: true, token, tier, email });
}
