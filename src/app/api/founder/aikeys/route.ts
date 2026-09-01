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
    const ai = new GoogleGenAI({ apiKey: key });
    let usedModel = "";
    const attempts: string[] = [];
    for (const model of AI_MODELS) {
      let advance = false;
      let fatal: { message: string } | null = null;
      for (let retry = 0; retry < 2 && !advance; retry++) {
        try {
          await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: "Reply with: OK" }] }],
            config: { maxOutputTokens: 5 },
          });
          usedModel = model;
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (isOverload(msg) && retry === 0) {
            await sleep(700);
            continue;
          }
          if (isModelError(msg)) {
            attempts.push(`${model}: not available`);
            advance = true;
          } else if (isOverload(msg)) {
            attempts.push(`${model}: overloaded (503)`);
            advance = true;
          } else {
            // Auth / quota — same for every model, so stop and report it.
            fatal = { message: msg };
          }
          if (fatal) break;
        }
      }
      if (usedModel) break;
      if (fatal) {
        return Response.json({
          ok: true,
          test: { status: "error", source, message: fatal.message.slice(0, 300) },
        });
      }
    }

    if (usedModel) {
      return Response.json({
        ok: true,
        test: {
          status: "ok",
          source,
          model: usedModel,
          message: `Working ✓ — using ${source}, model "${usedModel}".`,
        },
      });
    }

    // Nothing worked — ask the key which models it actually supports, so we know
    // exactly what to use (set it as GEMINI_MODEL).
    let available: string[] = [];
    try {
      const pager = await ai.models.list();
      for await (const m of pager) {
        const nm = (m.name || "").replace(/^models\//, "");
        const methods =
          (m as { supportedActions?: string[] }).supportedActions || [];
        if (nm && (methods.length === 0 || methods.includes("generateContent"))) {
          available.push(nm);
        }
      }
    } catch {
      /* ignore — listing may itself fail if the key is bad */
    }
    const flash = available.filter((m) => m.includes("flash")).slice(0, 12);
    return Response.json({
      ok: true,
      test: {
        status: "error",
        source,
        message:
          `None of the tried models worked (${attempts.join("; ") || "all overloaded"}).` +
          (flash.length
            ? ` Your key DOES support these — set GEMINI_MODEL to one of them in Vercel: ${flash.join(", ")}.`
            : available.length
              ? ` Available models: ${available.slice(0, 12).join(", ")}.`
              : " Could not list the key's available models."),
        available,
      },
    });
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
