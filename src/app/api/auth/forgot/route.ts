import { NextRequest } from "next/server";
import { getAccount, kvConfigured, normalizeMatric, updateAccount } from "@/lib/kv";
import { signReset } from "@/lib/token";
import { mailerConfigured, sendResetEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const RESET_TTL = 60 * 60 * 1000; // reset links are valid for 1 hour

/**
 * Start a password reset.
 *  - If the account has an email on file (or provides one when none is saved),
 *    we email a one-time reset link.
 *  - Otherwise we flag the account so the owner can issue a temporary password
 *    from the Founder Panel.
 * The response is deliberately neutral — it never reveals whether a matric is
 * registered or which email it uses.
 */
export async function POST(req: NextRequest) {
  let matric = "";
  let email = "";
  try {
    const b = await req.json();
    matric = normalizeMatric(String(b?.matric ?? ""));
    email = String(b?.email ?? "").trim().toLowerCase();
  } catch {
    /* ignore */
  }

  const neutral = Response.json({
    ok: true,
    message:
      "If that matric number has an account, we've sent a reset link to the email on file. Check your inbox (and spam). No email on your account? Ask your coordinator to reset it for you.",
  });

  if (!matric || !kvConfigured()) return neutral;

  const acc = await getAccount(matric);
  if (!acc) return neutral;

  // Pick the destination: the on-file email wins; if none is saved yet, adopt
  // the one they typed (matric is the secret that authorises this).
  let target = acc.email || "";
  if (!target && email.includes("@")) {
    target = email;
    await updateAccount(matric, { email });
  }

  if (target && mailerConfigured()) {
    const exp = Date.now() + RESET_TTL;
    const token = signReset(matric, exp);
    const origin = process.env.APP_URL || req.nextUrl.origin;
    const link = `${origin}/reset?token=${encodeURIComponent(token)}`;
    const sent = await sendResetEmail(target, acc.name ?? "", link);
    if (sent) {
      await updateAccount(matric, { resetRequested: Date.now() });
      return neutral;
    }
  }

  // No email / mailer not set up → founder-managed fallback.
  await updateAccount(matric, { resetRequested: Date.now() });
  return neutral;
}
