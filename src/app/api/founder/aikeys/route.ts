import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";
import {
  addAiKey,
  deleteAiKey,
  kvConfigured,
  listAiKeys,
  pickAiKey,
  setAiKeyEnabled,
} from "@/lib/kv";
import { AI_MODELS, isModelError, isOverload, sleep } from "@/lib/aimodels";

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

  // End-to-end check: pick a key exactly as the chat would and make a tiny real
  // request, so the founder sees the true cause (no key / disabled / rejected /
  // quota / bad model) instead of just a status colour.
  if (action === "test") {
    let key: string | undefined;
    let source = "";
    const cand = await pickAiKey([]);
    if (cand) {
      key = cand.key;
      source = `pool key #${cand.id}`;
    } else if (process.env.GEMINI_API_KEY) {
      key = process.env.GEMINI_API_KEY;
      source = "environment key";
    }
    if (!key) {
      return Response.json({
        ok: true,
        test: {
          status: "no_key",
          message:
            "No usable key was found. Add a key and make sure its toggle is ON (enabled).",
        },
      });
    }
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      let usedModel = "";
      let lastErr: unknown = null;
      for (const model of AI_MODELS) {
        let advance = false;
        for (let retry = 0; retry < 2 && !advance; retry++) {
          try {
            await ai.models.generateContent({
              model,
              contents: [{ role: "user", parts: [{ text: "Reply with: OK" }] }],
              config: { maxOutputTokens: 5 },
            });
            usedModel = model;
            lastErr = null;
            break;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            lastErr = e;
            if (isOverload(msg) && retry === 0) {
              await sleep(700);
              continue;
            }
            if (isModelError(msg) || isOverload(msg)) {
              advance = true;
              break;
            }
            throw e;
          }
        }
        if (usedModel) break;
      }
      if (!usedModel && lastErr) throw lastErr;
      return Response.json({
        ok: true,
        test: {
          status: "ok",
          source,
          model: usedModel,
          message: `Working ✓ — using ${source}, model "${usedModel}".`,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json({
        ok: true,
        test: { status: "error", source, message: msg.slice(0, 300) },
      });
    }
  }

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
