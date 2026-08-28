import { NextRequest } from "next/server";
import { verifyReset } from "@/lib/token";
import { getAccount, kvConfigured, updateAccount } from "@/lib/kv";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

/** Complete a self-service reset: a valid, unexpired reset token + a new
 *  password sets the account's password and clears the reset flags. */
export async function POST(req: NextRequest) {
  if (!kvConfigured()) {
    return Response.json({ ok: false, message: "Not available." }, { status: 503 });
  }

  let token = "";
  let newPassword = "";
  try {
    const b = await req.json();
    token = String(b?.token ?? "");
    newPassword = String(b?.newPassword ?? "");
  } catch {
    /* ignore */
  }

  const claims = verifyReset(token);
  if (!claims) {
    return Response.json(
      { ok: false, message: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 },
    );
  }
  if (newPassword.length < 6) {
    return Response.json(
      { ok: false, message: "Your new password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const acc = await getAccount(claims.matric);
  if (!acc) {
    return Response.json({ ok: false, message: "Account not found." }, { status: 404 });
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

  return Response.json({ ok: true, matric: claims.matric });
}
