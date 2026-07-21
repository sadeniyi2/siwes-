import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import { verifyAccess } from "@/lib/token";
import { isProAction } from "@/lib/plans";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// gemini-flash-latest is an alias that always resolves to the current free-tier
// Flash model, so it won't 404 when Google retires a specific version.
// Override via the GEMINI_MODEL env var to pin a specific model.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

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

  // Prefer the visitor's own key (sent as a header). Fall back to a server key
  // only if the owner chose to set one — leave GEMINI_API_KEY unset on Vercel
  // to keep every visitor on their own key.
  const userKey = req.headers.get("x-gemini-key")?.trim();
  const apiKey = userKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        reason: "no_key",
        message:
          "Add your own free Gemini API key to start. Get one at https://aistudio.google.com/apikey",
      },
      { status: 401 },
    );
  }

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

  const ai = new GoogleGenAI({ apiKey });
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

  // Open the stream up front so we can surface auth/quota errors as HTTP status
  // codes (which the client turns into a "paste a new key" prompt) rather than
  // burying them inside the streamed body.
  let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
  try {
    stream = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(todayISO),
        maxOutputTokens: 32768,
        temperature: 0.6,
      },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const { status, reason, message } = classify(raw);
    return Response.json({ reason, message }, { status });
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
