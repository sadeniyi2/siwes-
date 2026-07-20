import { signAccess } from "@/lib/token";

export const runtime = "nodejs";

const TRIAL_DAYS = 7;

/** Mint a short, Basic-level trial token so people can test before paying.
 *  The AI runs on each user's own Gemini key, so a trial costs the owner
 *  nothing — the client caps the number of free generations. */
export async function POST() {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      { ok: false, message: "Access is not configured yet." },
      { status: 500 },
    );
  }
  const now = Date.now();
  const token = signAccess({
    email: "",
    tier: "basic",
    kind: "trial",
    ref: `trial:${now}`,
    iat: now,
    exp: now + TRIAL_DAYS * 24 * 60 * 60 * 1000,
  });
  return Response.json({ ok: true, token, tier: "basic", kind: "trial" });
}
