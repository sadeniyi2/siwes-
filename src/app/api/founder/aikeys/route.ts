import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import {
  addAiKey,
  deleteAiKey,
  kvConfigured,
  listAiKeys,
  setAiKeyEnabled,
} from "@/lib/kv";

export const runtime = "nodejs";

/**
 * Founder-only management of the shared Gemini key pool.
 *   { action: "list" }
 *   { action: "add", key, label? }
 *   { action: "delete", id }
 *   { action: "toggle", id, enabled }
 * Keys are stored server-side only and never returned in full (masked in list).
 */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-founder-token"));
  if (!claims || claims.role !== "admin") {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!kvConfigured()) {
    return Response.json(
      { ok: false, message: "Connect Supabase to manage AI keys." },
      { status: 400 },
    );
  }

  let body: { action?: string; key?: string; label?: string; id?: number; enabled?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const action = body.action ?? "list";
  if (action === "add") {
    const key = String(body.key ?? "").trim();
    if (!key) {
      return Response.json({ ok: false, message: "Paste a Gemini key." }, { status: 400 });
    }
    const ok = await addAiKey(key, body.label);
    if (!ok) {
      return Response.json({ ok: false, message: "Could not save the key." }, { status: 500 });
    }
  } else if (action === "delete" && typeof body.id === "number") {
    await deleteAiKey(body.id);
  } else if (action === "toggle" && typeof body.id === "number") {
    await setAiKeyEnabled(body.id, !!body.enabled);
  }

  const keys = await listAiKeys();
  return Response.json({ ok: true, keys });
}
