import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { updateAccount } from "@/lib/kv";

export const runtime = "nodejs";

/** Save the logged-in student's logbook data to their account. */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims?.matric) return Response.json({ ok: false }, { status: 401 });

  let data = "";
  let name = "";
  try {
    const b = await req.json();
    data = String(b?.data ?? "");
    name = String(b?.name ?? "").trim().slice(0, 120);
  } catch {
    /* ignore */
  }
  if (!data) return Response.json({ ok: false }, { status: 400 });
  if (data.length > 1_500_000) return Response.json({ ok: false }, { status: 413 });

  const patch: Parameters<typeof updateAccount>[1] = { data };
  if (name) patch.name = name;
  const ok = await updateAccount(claims.matric, patch);
  return Response.json({ ok });
}
