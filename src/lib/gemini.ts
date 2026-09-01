import "server-only";
import type { GoogleGenAI } from "@google/genai";
import { AI_MODELS, isModelError, isOverload, sleep } from "./aimodels";

let cached: { model: string; at: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

function getCachedModel(): string | null {
  return cached && Date.now() - cached.at < CACHE_TTL ? cached.model : null;
}
function setCachedModel(model: string) {
  cached = { model, at: Date.now() };
}

export async function listGenerateContentModels(ai: GoogleGenAI): Promise<string[]> {
  const out: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      const nm = (m.name || "").replace(/^models\//, "");
      const methods = (m as any).supportedGenerationMethods || [];
      if (nm && methods.includes("generateContent")) {
        out.push(nm);
      }
    }
  } catch {
    /* listing itself can fail on a bad key — caller handles */
  }
  return out;
}

export function orderPreferred(models: string[]): string[] {
  const pref = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];
  const inPref = pref.filter((p) => models.includes(p));
  const otherFlash = models.filter(
    (m) => m.includes("flash") && !inPref.includes(m) && !m.includes("1.5") && !m.includes("1.0") && !m.includes("vision") && !m.includes("thinking") && !m.includes("exp"),
  );
  const rest = models.filter((m) => !inPref.includes(m) && !otherFlash.includes(m));
  return [...inPref, ...otherFlash, ...rest];
}

type StreamResult = Awaited<ReturnType<GoogleGenAI["models"]["generateContentStream"]>>;

export async function openGeminiStream(
  ai: GoogleGenAI,
  contents: unknown,
  config: unknown,
): Promise<StreamResult> {
  const tried = new Set<string>();
  let sawModelNotFound = false;
  let lastErr: unknown = null;

  const attempt = async (model: string): Promise<StreamResult | null> => {
    for (let retry = 0; retry < 2; retry++) {
      try {
        return await ai.models.generateContentStream({
          model,
          contents: contents as any,
          config: config as any,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = e;
        if (isOverload(msg) && retry === 0) {
          await sleep(700);
          continue;
        }
        if (isModelError(msg)) {
          sawModelNotFound = true;
          return null;
        }
        if (isOverload(msg)) return null;
        throw e; 
      }
    }
    return null;
  };

  const candidates = [getCachedModel(), ...AI_MODELS].filter(Boolean) as string[];
  for (const model of candidates) {
    if (tried.has(model)) continue;
    tried.add(model);
    const s = await attempt(model);
    if (s) {
      setCachedModel(model);
      return s;
    }
  }

  if (sawModelNotFound) {
    const discovered = orderPreferred(await listGenerateContentModels(ai));
    for (const model of discovered) {
      if (tried.has(model)) continue;
      tried.add(model);
      const s = await attempt(model);
      if (s) {
        setCachedModel(model);
        return s;
      }
    }
  }

  throw lastErr ?? new Error("No usable Gemini model was found for this key.");
}
