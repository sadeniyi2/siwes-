import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// gemini-2.5-flash is on the Gemini API free tier; override via env if needed.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and add it in your Vercel project settings (or .env.local for local dev).",
      { status: 500 },
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

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = await ai.models.generateContentStream({
          model: MODEL,
          contents,
          config: {
            systemInstruction: buildSystemPrompt(todayISO),
            maxOutputTokens: 16384,
            temperature: 0.6,
          },
        });
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
