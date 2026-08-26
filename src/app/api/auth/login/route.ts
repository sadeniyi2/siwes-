import { NextRequest } from "next/server";
import { getAccount, kvConfigured, normalizeEmail, updateAccount } from "@/lib/kv";
import { verifyPassword } from "@/lib/password";
import { issueAccountToken } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_TOKEN_SECRET || !kvConfigured()) {
    return Response.json(
      { ok: false, message: "Accounts aren't set up yet. Please try again later." },
      { status: 503 },
    );
  }

  let email = "";
  let password = "";
  try {
    const b = await req.json();
    email = normalizeEmail(String(b?.email ?? ""));
    password = String(b?.password ?? "");
  } catch {
    /* ignore */
  }

  const acc = email ? await getAccount(email) : null;
  if (!acc || !acc.passHash || !acc.salt || !verifyPassword(password, acc.passHash, acc.salt)) {
    return Response.json(
      { ok: false, message: "Wrong email or password." },
      { status: 401 },
    );
  }

  void updateAccount(email, {}); // touch last_seen
  const issued = issueAccountToken(acc);
  return Response.json({
    ok: true,
    token: issued.token,
    email,
    name: acc.name ?? "",
    tier: issued.tier ?? null,
    kind: issued.kind ?? null,
    exp: issued.exp,
    hasAccess: issued.hasAccess,
  });
}
