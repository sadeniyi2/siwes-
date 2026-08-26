import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { getAccount, kvConfigured } from "@/lib/kv";
import { issueAccountToken } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Validate the stored token and, when it belongs to an account, refresh it from
 * the account's current access (so a payment/code/admin change or an expired
 * trial is reflected right away). Returns `access` = has a usable tier.
 */
export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = await req.json();
    token = body?.token ?? "";
  } catch {
    /* ignore */
  }

  const claims = verifyAccess(token);
  if (!claims) return Response.json({ valid: false });

  // Account-backed token → reload the account and re-issue a fresh token.
  if (claims.email && kvConfigured() && claims.role !== "admin") {
    const acc = await getAccount(claims.email);
    if (acc) {
      const issued = issueAccountToken(acc);
      return Response.json({
        valid: true,
        access: issued.hasAccess,
        tier: issued.tier ?? null,
        kind: issued.kind ?? null,
        exp: issued.exp,
        email: acc.email,
        name: acc.name ?? "",
        token: issued.token,
      });
    }
  }

  const hasTier = claims.tier === "basic" || claims.tier === "pro";
  return Response.json({
    valid: true,
    access: hasTier,
    tier: claims.tier ?? null,
    kind: claims.kind ?? "paid",
    email: claims.email,
  });
}
