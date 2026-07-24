import { NextRequest } from "next/server";
import { signAccess, Tier, verifyAccess } from "@/lib/token";
import { deleteTrial, deleteUser, kvConfigured } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * Founder-only actions.
 *   { action: "delete-trial", id: <matric> }
 *   { action: "delete-user",  id: <userId> }
 *   { action: "grant", email?, name?, tier? }  -> mints a paid token to share
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
