import { NextRequest } from "next/server";
import { signAccess } from "@/lib/token";
import { validateCode } from "@/lib/kv";

export const runtime = "nodejs";

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
    // Deliberately vague — don't reveal whether codes exist.
    return Response.json(
      { ok: false, message: "That code isn't valid." },
      { status: 403 },
    );
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
