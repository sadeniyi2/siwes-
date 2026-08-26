import { NextRequest } from "next/server";
import { createAccount, getAccount, kvConfigured, normalizeEmail } from "@/lib/kv";
import { hashPassword } from "@/lib/password";
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
  let name = "";
  let matric = "";
  try {
    const b = await req.json();
    email = normalizeEmail(String(b?.email ?? ""));
    password = String(b?.password ?? "");
    name = String(b?.name ?? "").trim().slice(0, 120);
    matric = String(b?.matric ?? "").trim().slice(0, 40);
  } catch {
    /* ignore */
  }

  if (!email || !email.includes("@") || email.length > 160) {
    return Response.json({ ok: false, message: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json(
      { ok: false, message: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  if (await getAccount(email)) {
    return Response.json(
      { ok: false, message: "That email is already registered — please log in instead." },
      { status: 409 },
    );
  }

  const { hash, salt } = hashPassword(password);
  const ok = await createAccount(email, name, hash, salt, matric);
  if (!ok) {
    return Response.json(
      { ok: false, message: "Couldn't create your account. Please try again." },
      { status: 500 },
    );
  }

  const acc = (await getAccount(email))!;
  const issued = issueAccountToken(acc);
  return Response.json({
    ok: true,
    token: issued.token,
    email,
    name,
    tier: issued.tier ?? null,
    kind: issued.kind ?? null,
    exp: issued.exp,
    hasAccess: issued.hasAccess,
  });
}
