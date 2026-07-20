import { signAccess } from "@/lib/token";

export const runtime = "nodejs";

const TRIAL_DAYS = 3;

/** Mint a Basic-level trial token so people can test before paying. Access
 *  lasts TRIAL_DAYS days (enforced server-side via the token's expiry). The AI
 *  runs on each user's own Gemini key, so a trial costs the owner nothing. */
export async function POST() {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      { ok: false, message: "Access is not configured yet." },
      { status: 500 },
    );
  }
  const now = Date.now();
  const exp = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const token = signAccess({
    email: "",
    tier: "basic",
    kind: "trial",
    ref: `trial:${now}`,
    iat: now,
    exp,
  });
  return Response.json({ ok: true, token, tier: "basic", kind: "trial", exp });
}
