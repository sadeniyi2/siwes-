import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { loadBackup } from "@/lib/kv";

export const runtime = "nodejs";

/** Return a student's cloud logbook snapshot for a matric number. Requires a
 *  valid access token (they must have access before restoring data). */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims) return Response.json({ ok: false }, { status: 402 });

  let matric = "";
  try {
    const b = await req.json();
    matric = String(b?.matric ?? "").trim().slice(0, 40);
  } catch {
    /* ignore */
  }
  if (!matric) return Response.json({ ok: false }, { status: 400 });

  const backup = await loadBackup(matric);
  if (!backup) return Response.json({ ok: true, found: false });
  return Response.json({ ok: true, found: true, data: backup.data, updated: backup.updated });
}
