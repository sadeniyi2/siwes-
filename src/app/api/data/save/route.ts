import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { updateAccount } from "@/lib/kv";

export const runtime = "nodejs";

/** Save the logged-in student's logbook data to their account. */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims?.email) return Response.json({ ok: false }, { status: 401 });

  let data = "";
  let matric = "";
  let name = "";
  try {
    const b = await req.json();
    data = String(b?.data ?? "");
    matric = String(b?.matric ?? "").trim().slice(0, 40);
    name = String(b?.name ?? "").trim().slice(0, 120);
  } catch {
    /* ignore */
  }
  if (!data) return Response.json({ ok: false }, { status: 400 });
  if (data.length > 1_500_000) return Response.json({ ok: false }, { status: 413 });

  const patch: Parameters<typeof updateAccount>[1] = { data };
  if (matric) patch.matric = matric;
  if (name) patch.name = name;
  const ok = await updateAccount(claims.email, patch);
  return Response.json({ ok });
}
