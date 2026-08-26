import { NextRequest } from "next/server";
import { signAccess } from "@/lib/token";
import { grantToAccount } from "@/lib/session";
import { recordCodeUse, validateCode } from "@/lib/kv";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return (
    xff.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

/**
 * Redeem an access ("referral") code. A valid code silently grants free access
 * (Pro by default). Codes are managed from the Founder Panel or via the
 * REFERRAL_CODES env var. The response never advertises that it's "free" — the
 * caller just receives a token.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      { ok: false, message: "Access is not configured yet." },
      { status: 500 },
    );
  }

  let code = "";
  let name = "";
  let email = "";
  try {
    const body = await req.json();
    code = String(body?.code ?? "").trim().slice(0, 64);
    name = String(body?.name ?? "").trim().slice(0, 120);
    email = String(body?.email ?? "").trim().slice(0, 120);
  } catch {
    /* ignore */
  }

  if (!code) {
    return Response.json(
      { ok: false, message: "Enter a code." },
      { status: 400 },
    );
  }

  const result = await validateCode(code);
  if (!result) {
    // Deliberately vague — don't reveal whether a code exists or is used up.
    return Response.json(
      { ok: false, message: "That code isn't valid or has been used up." },
      { status: 403 },
    );
  }

  // Log who redeemed it, for the founder's "used by" list (best-effort).
  void recordCodeUse(code, name, clientIp(req));

  // Attach the access to the logged-in account when there is one.
  const granted = await grantToAccount(req.headers.get("x-access-token"), {
    tier: result.tier,
    kind: "free",
  });
  if (granted) {
    return Response.json({
      ok: true,
      token: granted.token,
      tier: result.tier,
      kind: "free",
    });
  }

  const token = signAccess({
    email,
    tier: result.tier,
    kind: "free",
    ref: `code:${code}`,
    iat: Date.now(),
    name: name || undefined,
  });
  return Response.json({ ok: true, token, tier: result.tier, kind: "free" });
}
