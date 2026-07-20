import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// gemini-flash-latest is an alias that always resolves to the current free-tier
// Flash model, so it won't 404 when Google retires a specific version.
// Override via the GEMINI_MODEL env var to pin a specific model.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

/** Classify a Gemini error so the client can react (e.g. prompt for a new key). */
function classify(message: string): { status: number; reason: string } {
  const m = message.toLowerCase();
  if (
    m.includes("api key not valid") ||
    m.includes("api_key_invalid") ||
    m.includes("invalid api key") ||
    m.includes("permission_denied") ||
    m.includes("401") ||
    m.includes("403")
  ) {
    return { status: 401, reason: "invalid_key" };
  }
  if (
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("429") ||
    m.includes("exhausted")
  ) {
    return { status: 429, reason: "quota" };
  }
  return { status: 502, reason: "error" };
}

export async function POST(req: NextRequest) {
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
    const message = err instanceof Error ? err.message : String(err);
    const { status, reason } = classify(message);
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
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`\n\n⚠️ The assistant hit an error: ${msg}`),
        );
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
