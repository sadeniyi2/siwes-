// Gemini model candidates, tried in order. Two reasons we fall through the list:
//  1. Google occasionally retires/renames a model (a "not found" error).
//  2. A given model can be temporarily overloaded ("high demand", 503) while a
//     different model version still has capacity.
// gemini-2.0-flash is put first because it's stable and high-capacity; the
// "-latest" alias is kept in the list so we're future-proof if versions change.
// Pin one with GEMINI_MODEL to force it (it's still tried first, with the others
// kept as fallbacks).
const FALLBACKS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-001",
];

export const AI_MODELS: string[] = process.env.GEMINI_MODEL
  ? [
      process.env.GEMINI_MODEL,
      ...FALLBACKS.filter((m) => m !== process.env.GEMINI_MODEL),
    ]
  : FALLBACKS;

/** True when an error looks like "this model name isn't available" (so we should
 *  try the next candidate rather than giving up). */
export function isModelError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("not supported") ||
    m.includes("unsupported") ||
    m.includes("does not exist")
  );
}

/** True when the model is temporarily overloaded (retry / try another model). */
export function isOverload(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("503") ||
    m.includes("unavailable") ||
    m.includes("high demand") ||
    m.includes("overloaded") ||
    m.includes("try again later") ||
    m.includes("500") ||
    m.includes("internal")
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
