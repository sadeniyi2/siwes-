import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { getAccount, kvConfigured, updateAccount } from "@/lib/kv";
import { hashPassword, verifyPassword } from "@/lib/password";
import { issueAccountToken } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Set a new password for the signed-in account. Two cases:
 *  - Normal change: the current password must be supplied and match.
 *  - Forced reset (account.mustReset, after a founder-issued temp password):
 *    the current temp password already got them a session, so only the new
 *    password is required.
 * Clears the mustReset flag and any pending reset request, then hands back a
 * fresh session token.
 */
export async function POST(req: NextRequest) {
  if (!kvConfigured()) {
    return Response.json({ ok: false, message: "Not available." }, { status: 503 });
  }

  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims?.matric) return Response.json({ ok: false }, { status: 401 });

  let newPassword = "";
  let currentPassword = "";
  try {
    const b = await req.json();
    newPassword = String(b?.newPassword ?? "");
    currentPassword = String(b?.currentPassword ?? "");
  } catch {
    /* ignore */
  }

  if (newPassword.length < 6) {
    return Response.json(
      { ok: false, message: "Your new password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const acc = await getAccount(claims.matric);
  if (!acc) return Response.json({ ok: false }, { status: 401 });

  // A normal (not forced) change must prove the current password.
  if (!acc.mustReset) {
    if (
      !acc.passHash ||
      !acc.salt ||
      !verifyPassword(currentPassword, acc.passHash, acc.salt)
    ) {
      return Response.json(
        { ok: false, message: "Your current password is incorrect." },
        { status: 401 },
      );
    }
  }

  const { hash, salt } = hashPassword(newPassword);
  const ok = await updateAccount(claims.matric, {
    passHash: hash,
    salt,
    mustReset: false,
    resetRequested: null,
  });
  if (!ok) {
    return Response.json(
      { ok: false, message: "Couldn't update your password. Please try again." },
      { status: 500 },
    );
  }

  const updated = (await getAccount(claims.matric)) ?? { ...acc, mustReset: false };
  const issued = issueAccountToken(updated);
  return Response.json({
    ok: true,
    token: issued.token,
    tier: issued.tier ?? null,
    kind: issued.kind ?? null,
    hasAccess: issued.hasAccess,
  });
}
