import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { kvConfigured, upsertUser } from "@/lib/kv";

export const runtime = "nodejs";

/** Clients report their own presence so the founder panel can show who's
 *  active and their trial status. Requires a valid access token (so only real
 *  users are recorded and the tier can't be spoofed). No-ops without a store. */
export async function POST(req: NextRequest) {
  if (!kvConfigured()) return Response.json({ ok: true, stored: false });

  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims || claims.role === "admin") {
    // No valid user token, or an admin token — nothing to record.
    return Response.json({ ok: true, stored: false });
  }

  let name: string | undefined;
  let email: string | undefined;
  let firm: string | undefined;
  let clientId = "";
  try {
    const b = await req.json();
    clientId = String(b?.clientId ?? "").slice(0, 64);
    name = b?.name ? String(b.name).slice(0, 80) : undefined;
    email = b?.email ? String(b.email).slice(0, 120) : undefined;
    firm = b?.firm ? String(b.firm).slice(0, 120) : undefined;
  } catch {
    /* ignore */
  }
  if (!clientId) clientId = claims.ref;

  await upsertUser(clientId, {
    name,
    email: email || claims.email || undefined,
    firm,
    kind: claims.kind ?? "paid",
    tier: claims.tier,
    trialExp: claims.exp,
  });

  return Response.json({ ok: true, stored: true });
}
