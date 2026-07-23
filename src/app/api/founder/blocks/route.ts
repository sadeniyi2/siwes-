import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import { addBlock, kvConfigured, listBlocks, removeBlock } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * Founder-only blocklist management. A blocked matric number or IP is barred
 * from the free trial for good (paying still works).
 *   { action: "list" }
 *   { action: "add", type: "matric"|"ip", value, reason? }
 *   { action: "remove", value }
 */
export async function POST(req: NextRequest) {
  const claims = verifyAccess(req.headers.get("x-founder-token"));
  if (!claims || claims.role !== "admin") {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!kvConfigured()) {
    return Response.json(
      { ok: false, message: "Connect Supabase to use the blocklist." },
      { status: 400 },
    );
  }

  let body: { action?: string; type?: string; value?: string; reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const action = body.action ?? "list";
  if (action === "add") {
    const value = String(body.value ?? "").trim();
    if (!value) {
      return Response.json({ ok: false, message: "Enter a value to block." }, { status: 400 });
    }
    const type = body.type === "ip" ? "ip" : "matric";
    const ok = await addBlock(type, value, body.reason);
    if (!ok) {
      return Response.json({ ok: false, message: "Could not save the block." }, { status: 500 });
    }
  } else if (action === "remove") {
    await removeBlock(String(body.value ?? "").trim());
  }

  const blocks = await listBlocks();
  return Response.json({ ok: true, blocks });
}
