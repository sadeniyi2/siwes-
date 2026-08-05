import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { saveBackup } from "@/lib/kv";

export const runtime = "nodejs";

/** Save a student's logbook snapshot to the cloud, keyed by matric number.
 *  Requires a valid access token. Best-effort — never blocks the app. */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims) return Response.json({ ok: false }, { status: 402 });

  let matric = "";
  let name = "";
  let data = "";
  try {
    const b = await req.json();
    matric = String(b?.matric ?? "").trim().slice(0, 40);
    name = String(b?.name ?? "").trim().slice(0, 120);
    data = String(b?.data ?? "");
  } catch {
    /* ignore */
  }
  if (!matric || !data) return Response.json({ ok: false }, { status: 400 });
  // Guard against oversized payloads (~1.5MB).
  if (data.length > 1_500_000) return Response.json({ ok: false }, { status: 413 });

  const ok = await saveBackup(matric, name, data);
  return Response.json({ ok });
}
