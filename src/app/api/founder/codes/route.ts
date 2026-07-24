import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { addCode, deleteCode, kvConfigured, listCodes, setCodeLimit } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * Founder-only management of referral / access codes.
 *   { action: "list" }                        -> all codes
 *   { action: "add", code, tier?, note? }     -> create/overwrite a code
 *   { action: "delete", code }                -> remove a code
 * Guarded by the admin token in the x-founder-token header.
 */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-founder-token"));
  if (!claims || claims.role !== "admin") {
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: {
    action?: string;
    code?: string;
    tier?: string;
    note?: string;
    maxUses?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const action = body.action ?? "list";

  if (action !== "list" && !kvConfigured()) {
    return Response.json(
      {
        ok: false,
        message:
          "Connect Supabase to create codes here (or set REFERRAL_CODES in your environment).",
      },
      { status: 400 },
    );
  }

  if (action === "add") {
    const code = String(body.code ?? "").trim().slice(0, 64);
    if (!code) {
      return Response.json(
        { ok: false, message: "Enter a code." },
        { status: 400 },
      );
    }
    const tier = body.tier === "basic" ? "basic" : "pro";
    const ok = await addCode(code, tier, body.note, body.maxUses);
    if (!ok) {
      return Response.json(
        { ok: false, message: "Could not save the code." },
        { status: 500 },
      );
    }
  } else if (action === "setlimit") {
    const code = String(body.code ?? "").trim();
    if (code) {
      await setCodeLimit(
        code,
        typeof body.maxUses === "number" && body.maxUses > 0 ? body.maxUses : null,
      );
    }
  } else if (action === "delete") {
    const code = String(body.code ?? "").trim();
    await deleteCode(code);
  }

  const codes = await listCodes();
  return Response.json({ ok: true, codes, tracking: kvConfigured() });
}
