import { NextRequest } from "next/server";
import { getAccount, kvConfigured, normalizeMatric, updateAccount } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * Start a password reset. We don't send email from the app, so this flags the
 * account as needing a reset — the owner sees the request in the Founder Panel
 * and issues a temporary password. The response is deliberately neutral (it
 * never reveals whether a matric is registered).
 */
export async function POST(req: NextRequest) {
  let matric = "";
  try {
    const b = await req.json();
    matric = normalizeMatric(String(b?.matric ?? ""));
  } catch {
    /* ignore */
  }

  const neutral = Response.json({
    ok: true,
    message:
      "If that matric number has an account, we've notified the owner. You'll be sent a temporary password to sign in with — then you can set a new one.",
  });

  if (!matric || !kvConfigured()) return neutral;

  const acc = await getAccount(matric);
  if (acc) {
    await updateAccount(matric, { resetRequested: Date.now() });
  }
  return neutral;
}
