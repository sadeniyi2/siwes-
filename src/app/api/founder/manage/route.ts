import { NextRequest } from "next/server";
import { signAccess, Tier, verifyAccess } from "@/lib/token";
import {
  createAccount,
  deleteTrial,
  deleteUser,
  getAccount,
  kvConfigured,
  listAccounts,
  listBackups,
  loadBackup,
  normalizeMatric,
  updateAccount,
} from "@/lib/kv";
import { hashPassword, tempPassword } from "@/lib/password";

export const runtime = "nodejs";

/**
 * Founder-only actions.
 *   { action: "delete-trial", id: <matric> }
 *   { action: "delete-user",  id: <userId> }
 *   { action: "grant", email?, name?, tier? }  -> mints a paid token to share
 *   { action: "create-account", email, name?, matric?, tier? }
 *        -> provisions a login with a temporary password (recovers the logbook
 *           from a matric backup if one exists). Returns the temp password once.
 *   { action: "reset-password", email }
 *        -> sets a new temporary password on an existing account. Returns it once.
 * Guarded by the admin token in x-founder-token.
 */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-founder-token"));
  if (!claims || claims.role !== "admin") {
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: {
    action?: string;
    id?: string;
    email?: string;
    name?: string;
    tier?: string;
    matric?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  // Manually activate a buyer (mint a paid token to send them as a link).
  if (body.action === "grant") {
    if (!process.env.ACCESS_TOKEN_SECRET) {
      return Response.json({ ok: false, message: "Not configured." }, { status: 500 });
    }
    const tier: Tier = body.tier === "basic" ? "basic" : "pro";
    const token = signAccess({
      email: String(body.email ?? "").trim().slice(0, 120),
      tier,
      kind: "paid",
      ref: `grant:${claims.name ?? "admin"}:${Date.now()}`,
      iat: Date.now(),
      name: String(body.name ?? "").trim().slice(0, 120) || undefined,
    });
    return Response.json({ ok: true, token, tier });
  }

  if (!kvConfigured()) {
    return Response.json(
      { ok: false, message: "Connect Supabase to manage records." },
      { status: 400 },
    );
  }

  // List the matric-keyed backups that exist, flagged with whether each one
  // already has a login — so the founder can see exactly who is recoverable.
  if (body.action === "list-backups") {
    const [backups, accounts] = await Promise.all([listBackups(), listAccounts()]);
    const have = new Set(accounts.map((a) => normalizeMatric(a.matric)));
    return Response.json({
      ok: true,
      backups: backups.map((b) => ({
        ...b,
        hasAccount: have.has(normalizeMatric(b.matric)),
      })),
    });
  }

  // One click: create a login for every backup that doesn't yet have an
  // account, restoring each student's logbook. Returns each new matric + its
  // temporary password so the founder can hand them out.
  if (body.action === "bulk-provision") {
    const [backups, accounts] = await Promise.all([listBackups(), listAccounts()]);
    const have = new Set(accounts.map((a) => normalizeMatric(a.matric)));
    const created: {
      matric: string;
      name: string;
      tempPassword: string;
      entries: number;
    }[] = [];
    for (const b of backups) {
      const m = normalizeMatric(b.matric);
      if (have.has(m)) continue;
      const backup = await loadBackup(m);
      const pw = tempPassword();
      const { hash, salt } = hashPassword(pw);
      const ok = await createAccount(m, b.name ?? "", hash, salt, {
        data: backup?.data,
        mustReset: true,
      });
      if (ok.ok) {
        created.push({ matric: m, name: b.name ?? "", tempPassword: pw, entries: b.entries });
        have.add(m);
      }
      if (created.length >= 300) break; // safety cap
    }
    return Response.json({ ok: true, created });
  }

  // Provision a login for an existing (pre-accounts) student, keyed by matric.
  // If that matric has a cloud backup, seed the account with it so their logbook
  // is restored the moment they sign in — on any device.
  if (body.action === "create-account") {
    const matric = normalizeMatric(String(body.matric ?? ""));
    if (matric.length < 4) {
      return Response.json(
        { ok: false, message: "Enter a valid matric / registration number." },
        { status: 400 },
      );
    }
    if (await getAccount(matric)) {
      return Response.json(
        {
          ok: false,
          message: "That matric already has an account. Use “Reset password” instead.",
        },
        { status: 409 },
      );
    }
    // A matric backup is already stored as the same snapshot JSON the account
    // uses ({v,data}), so seed it verbatim.
    let data: string | undefined;
    const backup = await loadBackup(matric);
    if (backup?.data) data = backup.data;

    const pw = tempPassword();
    const { hash, salt } = hashPassword(pw);
    const tier = body.tier === "basic" ? "basic" : body.tier === "pro" ? "pro" : undefined;
    const created = await createAccount(
      matric,
      String(body.name ?? "").trim(),
      hash,
      salt,
      {
        email: String(body.email ?? "").trim() || undefined,
        data,
        mustReset: true,
        tier,
        kind: tier ? "paid" : undefined,
      },
    );
    if (!created.ok) {
      return Response.json(
        {
          ok: false,
          message: created.conflict
            ? "That matric already has an account. Use “Reset password” instead."
            : "Couldn't create that account. Please try again.",
          detail: created.error,
        },
        { status: created.conflict ? 409 : 500 },
      );
    }
    return Response.json({
      ok: true,
      matric,
      tempPassword: pw,
      recovered: !!data,
    });
  }

  // Reset an existing account to a fresh temporary password (used to answer a
  // "forgot password" request, or a founder-initiated reset).
  if (body.action === "reset-password") {
    const matric = normalizeMatric(String(body.matric ?? ""));
    const acc = matric ? await getAccount(matric) : null;
    if (!acc) {
      return Response.json(
        { ok: false, message: "No account with that matric number." },
        { status: 404 },
      );
    }
    const pw = tempPassword();
    const { hash, salt } = hashPassword(pw);
    const ok = await updateAccount(matric, {
      passHash: hash,
      salt,
      mustReset: true,
      resetRequested: null,
    });
    if (!ok) {
      return Response.json(
        { ok: false, message: "Couldn't reset that password. Please try again." },
        { status: 500 },
      );
    }
    return Response.json({ ok: true, matric, tempPassword: pw });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, message: "Missing id." }, { status: 400 });
  }

  let ok = false;
  if (body.action === "delete-trial") ok = await deleteTrial(id);
  else if (body.action === "delete-user") ok = await deleteUser(id);
  else return Response.json({ ok: false, message: "Unknown action." }, { status: 400 });

  return Response.json({ ok });
}
