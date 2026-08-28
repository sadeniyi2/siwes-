import { NextRequest } from "next/server";
import {
  createAccount,
  getAccount,
  kvConfigured,
  loadBackup,
  normalizeMatric,
} from "@/lib/kv";
import { hashPassword } from "@/lib/password";
import { issueAccountToken } from "@/lib/session";

export const runtime = "nodejs";

/** Create an account keyed by matric number (the student's unique id). Email is
 *  optional (kept only for receipts). If a cloud backup already exists for this
 *  matric, it's restored into the new account right away. */
export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_TOKEN_SECRET || !kvConfigured()) {
    return Response.json(
      { ok: false, message: "Accounts aren't set up yet. Please try again later." },
      { status: 503 },
    );
  }

  let matricRaw = "";
  let password = "";
  let name = "";
  let email = "";
  try {
    const b = await req.json();
    matricRaw = String(b?.matric ?? "");
    password = String(b?.password ?? "");
    name = String(b?.name ?? "").trim().slice(0, 120);
    email = String(b?.email ?? "").trim().slice(0, 160);
  } catch {
    /* ignore */
  }

  const matric = normalizeMatric(matricRaw);
  if (matric.length < 4 || matric.length > 40) {
    return Response.json(
      { ok: false, message: "Enter your matric / registration number." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return Response.json(
      { ok: false, message: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  if (await getAccount(matric)) {
    return Response.json(
      {
        ok: false,
        message: "That matric number already has an account — please log in instead.",
      },
      { status: 409 },
    );
  }

  // Recover an existing cloud backup for this matric, if any, so their logbook
  // is there the moment they sign in (a matric backup is stored as the same
  // snapshot JSON the account uses).
  let data: string | undefined;
  try {
    const backup = await loadBackup(matric);
    if (backup?.data) data = backup.data;
  } catch {
    /* best-effort recovery */
  }

  const { hash, salt } = hashPassword(password);
  const ok = await createAccount(matric, name, hash, salt, {
    email: email || undefined,
    data,
  });
  if (!ok) {
    return Response.json(
      { ok: false, message: "Couldn't create your account. Please try again." },
      { status: 500 },
    );
  }

  const acc = (await getAccount(matric))!;
  const issued = issueAccountToken(acc);
  return Response.json({
    ok: true,
    token: issued.token,
    matric,
    name,
    tier: issued.tier ?? null,
    kind: issued.kind ?? null,
    exp: issued.exp,
    hasAccess: issued.hasAccess,
    recovered: !!data,
    mustReset: false,
  });
}
