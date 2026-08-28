import { NextRequest } from "next/server";
import { getAccount, kvConfigured, normalizeMatric, updateAccount } from "@/lib/kv";
import { verifyPassword } from "@/lib/password";
import { issueAccountToken } from "@/lib/session";

export const runtime = "nodejs";

/** Sign in with matric number + password. */
export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_TOKEN_SECRET || !kvConfigured()) {
    return Response.json(
      { ok: false, message: "Accounts aren't set up yet. Please try again later." },
      { status: 503 },
    );
  }

  let matric = "";
  let password = "";
  try {
    const b = await req.json();
    matric = normalizeMatric(String(b?.matric ?? ""));
    password = String(b?.password ?? "");
  } catch {
    /* ignore */
  }

  const acc = matric ? await getAccount(matric) : null;
  if (
    !acc ||
    !acc.passHash ||
    !acc.salt ||
    !verifyPassword(password, acc.passHash, acc.salt)
  ) {
    return Response.json(
      { ok: false, message: "Wrong matric number or password." },
      { status: 401 },
    );
  }

  void updateAccount(matric, {}); // touch last_seen
  const issued = issueAccountToken(acc);
  return Response.json({
    ok: true,
    token: issued.token,
    matric,
    name: acc.name ?? "",
    tier: issued.tier ?? null,
    kind: issued.kind ?? null,
    exp: issued.exp,
    hasAccess: issued.hasAccess,
    mustReset: acc.mustReset ?? false,
  });
}
