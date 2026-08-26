import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { getAccount } from "@/lib/kv";

export const runtime = "nodejs";

/** Load the logged-in student's logbook data from their account. */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims?.email) return Response.json({ ok: false }, { status: 401 });

  const acc = await getAccount(claims.email);
  if (!acc?.data) return Response.json({ ok: true, found: false });
  return Response.json({ ok: true, found: true, data: acc.data });
}
