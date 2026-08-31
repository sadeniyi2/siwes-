import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import { verifyAccess } from "@/lib/token";
import { isProAction } from "@/lib/plans";
import { AI_MODELS, isModelError } from "@/lib/aimodels";
import {
  bumpAiKeyUse,
  checkAndBumpUsage,
  markAiKeyStatus,
  pickAiKey,
} from "@/lib/kv";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Turn a raw Gemini error into a clean, friendly message the user can read. */
function friendlyMessage(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("503") ||
    m.includes("unavailable") ||
    m.includes("high demand") ||
    m.includes("overloaded")
  ) {
    return "The AI is very busy right now. This is usually temporary — please wait a minute and try again.";
  }
  if (m.includes("500") || m.includes("internal")) {
    return "The AI service had a brief problem. Please try again.";
  }
  if (m.includes("timeout") || m.includes("deadline")) {
    return "That took too long to generate. Please try again.";
  }
  if (m.includes("safety") || m.includes("blocked") || m.includes("candidate")) {
    return "The assistant couldn't respond to that. Try rewording your notes.";
  }
  return "Something went wrong reaching the AI. Please try again in a moment.";
}

/** Classify a Gemini error so the client can react (e.g. prompt for a new key). */
function classify(message: string): { status: number; reason: string; message: string } {
  const m = message.toLowerCase();
  if (
    m.includes("api key not valid") ||
    m.includes("api_key_invalid") ||
    m.includes("invalid api key") ||
    m.includes("permission_denied") ||
    m.includes("401") ||
    m.includes("403")
  ) {
    return {
      status: 401,
      reason: "invalid_key",
      message: "That Gemini key was rejected. Please check it and try again.",
    };
  }
  if (
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("429") ||
    m.includes("exhausted")
  ) {
    return {
      status: 429,
      reason: "quota",
      message: "This key's free quota is used up for now.",
    };
  }
  return { status: 503, reason: "busy", message: friendlyMessage(message) };
}

export async function POST(req: NextRequest) {
  // Paywall: require a valid, signed access token (proof of payment).
  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims) {
    return Response.json(
      { reason: "locked", message: "Your access could not be verified." },
      { status: 402 },
    );
  }

  // The visitor's own key (if they added one) is preferred so it never spends
  // the owner's quota. Otherwise we fall back to the owner's managed key pool.
  const userKey = req.headers.get("x-gemini-key")?.trim();
  const clientId = req.headers.get("x-client-id")?.trim() || claims.ref || "anon";

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response("messages is required", { status: 400 });
  }

  // Bound the payload so the endpoint can't be abused with huge requests.
  if (body.messages.length > 80) {
    return new Response("Too many messages", { status: 400 });
  }
  const totalChars =
    body.messages.reduce((n, m) => n + (m?.content?.length ?? 0), 0) +
    (body.memory?.length ?? 0);
  if (totalChars > 500_000) {
    return new Response("Request too large", { status: 413 });
  }
  if (body.messages.some((m) => m.role !== "user" && m.role !== "assistant")) {
    return new Response("Invalid message role", { status: 400 });
  }

  // Tier enforcement: Basic users can't trigger Pro-only actions.
  if (claims.tier === "basic") {
    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
    if (lastUser && isProAction(lastUser.content)) {
      return Response.json(
        {
          reason: "pro_required",
          message:
            "That feature is part of the Pro plan. Upgrade to unlock monthly summaries, the final report builder, and diagrams.",
        },
        { status: 403 },
      );
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  // Per-request context (saved-entry memory) rides on the first user turn.
  const contents = body.messages.map((m, i) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [
      {
        text:
          i === 0 && m.role === "user"
            ? `<internship_memory>\n${body.memory || "No entries saved yet."}\n</internship_memory>\n\n${m.content}`
            : m.content,
      },
    ],
  }));
  if (contents[0]?.role !== "user") {
    contents.unshift({
      role: "user",
      parts: [
        {
          text: `<internship_memory>\n${body.memory || "No entries saved yet."}\n</internship_memory>`,
        },
      ],
    });
  }

  // A per-student daily cap applies ONLY when using the owner's pooled key, so a
  // few heavy users can't burn the owner's quota. Students on their own key are
  // unlimited. Fails open if the store is unavailable.
  if (!userKey) {
    const limit = Number(process.env.POOL_DAILY_LIMIT || "40");
    const usage = await checkAndBumpUsage(clientId, limit);
    if (!usage.ok) {
      return Response.json(
        {
          reason: "rate_limited",
          message: `You've reached today's limit of ${limit} messages. Please continue tomorrow — or add your own free Gemini key in the key menu for unlimited use.`,
        },
        { status: 429 },
      );
    }
  }

  const genConfig = {
    systemInstruction: buildSystemPrompt(todayISO),
    maxOutputTokens: 32768,
    temperature: 0.6,
  };

  // Open the stream up front so we can surface auth/quota errors as HTTP status
  // codes. When using the owner's pool, a quota/invalid key auto-rotates to the
  // next key so students never see the failure.
  let stream:
    | Awaited<ReturnType<GoogleGenAI["models"]["generateContentStream"]>>
    | null = null;
  const tried: number[] = [];
  let envTried = false;
  let lastErr: { status: number; reason: string; message: string } | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    let key: string | undefined;
    let poolId: number | null = null;
    let poolUses = 0;

    if (userKey) {
      if (attempt > 0) break; // no rotation for the student's own key
      key = userKey;
    } else {
      const cand = await pickAiKey(tried);
      if (cand) {
        key = cand.key;
        poolId = cand.id;
        poolUses = cand.uses;
        tried.push(cand.id);
      } else if (!envTried && process.env.GEMINI_API_KEY) {
        key = process.env.GEMINI_API_KEY;
        envTried = true;
      }
    }
    if (!key) break;

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      // Try each model candidate; a "model not found" falls through to the next
      // so a retired/renamed model can't take the whole app down.
      let modelErr: unknown = null;
      for (const model of AI_MODELS) {
        try {
          stream = await ai.models.generateContentStream({
            model,
            contents,
            config: genConfig,
          });
          modelErr = null;
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (isModelError(msg)) {
            modelErr = e;
            continue;
          }
          throw e;
        }
      }
      if (!stream && modelErr) throw modelErr;
      if (poolId != null) void bumpAiKeyUse(poolId, poolUses);
      break;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const c = classify(raw);
      lastErr = c;
      if (poolId != null) {
        // Mark this pool key and rotate to the next one.
        if (c.reason === "quota") void markAiKeyStatus(poolId, "exhausted");
        else if (c.reason === "invalid_key") void markAiKeyStatus(poolId, "invalid");
        continue;
      }
      // The student's own key (or the env key) failed — report it.
      return Response.json({ reason: c.reason, message: c.message }, { status: c.status });
    }
  }

  if (!stream) {
    if (lastErr) {
      const message =
        lastErr.reason === "quota"
          ? "The AI is very busy right now (all keys are at their limit). Please try again in a little while."
          : lastErr.message;
      return Response.json({ reason: lastErr.reason, message }, { status: lastErr.status });
    }
    return Response.json(
      {
        reason: "no_key",
        message:
          "The AI isn't set up yet. Please try again later, or add your own free Gemini key in the key menu.",
      },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${friendlyMessage(raw)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
