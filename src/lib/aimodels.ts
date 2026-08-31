// Gemini model candidates, tried in order. Google occasionally retires or
// renames a model; when the first choice 404s we fall through to the next, so
// the chat keeps working without a redeploy. Pin one with GEMINI_MODEL to force it.
const FALLBACKS = [
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
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
