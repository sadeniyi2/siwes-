import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      "ANTHROPIC_API_KEY is not set. Add it in your Vercel project settings (or .env.local for local dev).",
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

  const client = new Anthropic();
  const todayISO = new Date().toISOString().slice(0, 10);

  // Volatile per-request context (memory, date) goes into the first user turn
  // so the system prompt stays byte-stable for prompt caching.
  const history: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const first = history[0];
  history[0] = {
    role: "user",
    content: `<internship_memory>\n${body.memory || "No entries saved yet."}\n</internship_memory>\n\n${
      first.role === "user" ? first.content : ""
    }`,
  };
  if (first.role !== "user") history.splice(1, 0, first);

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: buildSystemPrompt(todayISO),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: history,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta));
      });
      stream.on("error", (err) => {
        controller.enqueue(
          encoder.encode(`\n\n⚠️ The assistant hit an error: ${err.message}`),
        );
        controller.close();
      });
      stream.on("end", () => controller.close());
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
