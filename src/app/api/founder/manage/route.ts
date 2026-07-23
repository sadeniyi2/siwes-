import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { deleteTrial, deleteUser, kvConfigured } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * Founder-only cleanup actions for duplicate / suspected-fraud records.
 *   { action: "delete-trial", id: <matric> }
 *   { action: "delete-user",  id: <userId> }
 * Guarded by the admin token in x-founder-token.
 */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-founder-token"));
  if (!claims || claims.role !== "admin") {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!kvConfigured()) {
    return Response.json(
      { ok: false, message: "Connect Supabase to manage records." },
      { status: 400 },
    );
  }

  let body: { action?: string; id?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
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
