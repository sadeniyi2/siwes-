import { NextRequest } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { verifyAccess } from "@/lib/token";
import {
  bumpAiKeyUse,
  checkAndBumpUsage,
  markAiKeyStatus,
  pickAiKey,
} from "@/lib/kv";
import { AI_MODELS, isModelError, isOverload, sleep } from "@/lib/aimodels";

export const runtime = "nodejs";
export const maxDuration = 60;

const YEAR = new Date().getFullYear();

const PROMPT = `You are an expert logbook extraction assistant for a SIWES (Student Industrial Work Experience Scheme) logbook.
Analyze this photo of a handwritten weekly logbook page / "Weekly Progress Chart".

Extract each day's entry accurately.
For each day found (Monday through Saturday):
1. Identify the date and format it as an ISO string (YYYY-MM-DD). If the year is missing, assume ${YEAR}. Nigerian handwriting often uses DD/MM/YY.
2. Transcribe the complete text written under "DESCRIPTION OF WORK DONE" for that day. Fix obvious spelling, keep the student's meaning. Skip days that are clearly blank.

Return ONLY a valid JSON array of objects with keys "date" (YYYY-MM-DD) and "description" (string). No markdown, no commentary.
Example: [{"date":"${YEAR}-08-31","description":"Conducted morning briefing and set up the test environment."}]`;

/** Classify a Gemini error so we can rotate keys on quota/invalid. */
function classify(message: string): "quota" | "invalid_key" | "other" {
  const m = message.toLowerCase();
  if (
    m.includes("api key not valid") ||
    m.includes("api_key_invalid") ||
    m.includes("invalid api key") ||
    m.includes("permission_denied") ||
    m.includes("401") ||
    m.includes("403")
  ) {
    return "invalid_key";
  }
  if (
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("rate limit") ||
    m.includes("429") ||
    m.includes("exhausted")
  ) {
    return "quota";
  }
  return "other";
}

/** Run the vision request for one key, trying model candidates. Returns the raw
 *  text, or throws (quota/invalid bubble up so the caller can rotate keys). */
async function extractWithKey(
  key: string,
  parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[],
): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: key });
  let lastErr: unknown = null;
  for (const model of AI_MODELS) {
    let advance = false;
    for (let retry = 0; retry < 2 && !advance; retry++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: { temperature: 0.2, maxOutputTokens: 4096 },
        });
        return res.text ?? "";
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
        throw e; // quota / invalid key → rotate keys
      }
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

export async function POST(req: NextRequest) {
  // Require a valid access token (same paywall as the chat).
  const claims = verifyAccess(req.headers.get("x-access-token"));
  if (!claims) {
    return Response.json(
      { error: "Your access could not be verified. Please sign in again." },
      { status: 402 },
    );
  }

  let imageBase64 = "";
  let mimeType = "image/jpeg";
  try {
    const b = await req.json();
    imageBase64 = String(b?.imageBase64 ?? "");
    mimeType = String(b?.mimeType ?? "image/jpeg");
  } catch {
    /* ignore */
  }
  if (!imageBase64) {
    return Response.json({ error: "No image provided." }, { status: 400 });
  }
  const data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  if (data.length > 8_000_000) {
    return Response.json(
      { error: "That image is too large. Please try a smaller photo." },
      { status: 413 },
    );
  }

  const userKey = req.headers.get("x-gemini-key")?.trim();
  const clientId = req.headers.get("x-client-id")?.trim() || claims.ref || "anon";

  // Per-student daily cap on pooled usage (a scan counts like a message).
  if (!userKey) {
    const limit = Number(process.env.POOL_DAILY_LIMIT || "40");
    const usage = await checkAndBumpUsage(clientId, limit);
    if (!usage.ok) {
      return Response.json(
        {
          error: `You've reached today's limit of ${limit} AI actions. Please continue tomorrow.`,
        },
        { status: 429 },
      );
    }
  }

  const parts = [{ text: PROMPT }, { inlineData: { mimeType, data } }];

  let rawText: string | null = null;
  const tried: number[] = [];
  let envTried = false;
  let lastClass: "quota" | "invalid_key" | "other" | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    let key: string | undefined;
    let poolId: number | null = null;
    let poolUses = 0;

    if (userKey) {
      if (attempt > 0) break;
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
      rawText = await extractWithKey(key, parts);
      if (poolId != null) void bumpAiKeyUse(poolId, poolUses);
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastClass = classify(msg);
      if (poolId != null) {
        if (lastClass === "quota") void markAiKeyStatus(poolId, "exhausted");
        else if (lastClass === "invalid_key") void markAiKeyStatus(poolId, "invalid");
        continue; // rotate to the next key
      }
      break; // student/env key failed
    }
  }

  if (rawText == null) {
    if (lastClass === "quota") {
      return Response.json(
        { error: "The AI is busy right now (all keys are at their limit). Please try again shortly." },
        { status: 429 },
      );
    }
    return Response.json(
      {
        error:
          "The AI scanner isn't available right now. Make sure a Gemini key is added in the Founder Panel, then try again.",
      },
      { status: 503 },
    );
  }

  // Pull the JSON array out of the response (tolerate code fences / stray text).
  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "");
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return Response.json(
      { error: "Couldn't read entries from that photo. Try a clearer, straight-on shot." },
      { status: 422 },
    );
  }
  try {
    const parsed = JSON.parse(match[0]);
    const entries = (Array.isArray(parsed) ? parsed : [])
      .filter(
        (e) =>
          e &&
          typeof e.date === "string" &&
          typeof e.description === "string" &&
          e.description.trim(),
      )
      .map((e) => ({ date: e.date.trim(), description: e.description.trim() }));
    return Response.json({ success: true, entries });
  } catch {
    return Response.json(
      { error: "Couldn't read entries from that photo. Try a clearer, straight-on shot." },
      { status: 422 },
    );
  }
}
