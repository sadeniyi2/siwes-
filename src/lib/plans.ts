// Shared, environment-agnostic plan definitions. NO "use client" here so the
// server (API routes) can import isProAction / PLANS safely.

export type Tier = "basic" | "pro";

export interface PlanInfo {
  id: Tier;
  name: string;
  price: number; // Naira (Flutterwave charges in plain NGN)
  tagline: string;
  benefits: string[];
  limitations: string[];
}

export const PLANS: Record<Tier, PlanInfo> = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 3000,
    tagline: "Everything you need for the daily logbook.",
    benefits: [
      "Turn your messy daily notes into clean, professional 35–70 word logbook entries",
      "Full digital Weekly Progress Chart — edit, navigate weeks, and print",
      "Generate Weekly Summaries for your records",
      "Save unlimited daily entries, kept privately on your device",
      "One-time payment — no subscription, yours for the whole placement",
    ],
    limitations: [
      "Monthly Summaries are not included",
      "The full Final SIWES Report builder is not included",
      "Smart diagrams and appendix visuals are not included",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 5000,
    tagline: "The complete package — right up to your final report.",
    benefits: [
      "Everything in Basic, plus:",
      "Generate Monthly Summaries",
      "Build the complete Final SIWES Report — cover page, certification, abstract, weekly & monthly activities, right through to the appendix",
      "Smart visuals: flowcharts, ER diagrams, system architectures and more for your report appendix",
      "Highest output length, so long reports are never cut short",
    ],
    limitations: ["Like every tier, you use your own free Gemini key"],
  },
};

/** Actions that require the Pro plan. */
export const PRO_TRIGGERS = [
  "generate monthly summary",
  "build final report",
  "generate chart",
  "generate graph",
  "generate workflow",
  "generate flowchart",
  "generate ai pipeline",
  "generate er diagram",
  "generate system architecture",
  "generate sequence diagram",
  "generate class diagram",
  "generate network diagram",
  "generate sketch",
  "generate appendix figure",
];

export function isProAction(text: string): boolean {
  const t = text.toLowerCase();
  return PRO_TRIGGERS.some((trigger) => t.includes(trigger));
}
