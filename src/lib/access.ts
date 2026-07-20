"use client";

import { Tier } from "./plans";

export type { Tier } from "./plans";
export { PLANS, PRO_TRIGGERS, isProAction, type PlanInfo } from "./plans";

export type Kind = "paid" | "free" | "trial";

/** How many free generations a trial gives before payment is required. */
export const TRIAL_LIMIT = 3;

const TOKEN_KEY = "siwes.access.token.v1";
const TIER_KEY = "siwes.access.tier.v1";
const KIND_KEY = "siwes.access.kind.v1";
const TRIAL_USED_KEY = "siwes.trial.used.v1";

export function loadAccessToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function loadTier(): Tier | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(TIER_KEY);
  return t === "basic" || t === "pro" ? t : null;
}

export function loadKind(): Kind | null {
  if (typeof window === "undefined") return null;
  const k = localStorage.getItem(KIND_KEY);
  return k === "paid" || k === "free" || k === "trial" ? k : null;
}

export function isTrial(): boolean {
  return loadKind() === "trial";
}

export function saveAccess(token: string, tier: Tier, kind: Kind = "paid") {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TIER_KEY, tier);
  localStorage.setItem(KIND_KEY, kind);
  window.dispatchEvent(new Event("siwes-access-change"));
}

/** Start a trial: store the trial token and reset the free-generation counter. */
export function saveTrial(token: string) {
  localStorage.setItem(TRIAL_USED_KEY, "0");
  saveAccess(token, "basic", "trial");
}

export function trialUsed(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(TRIAL_USED_KEY) ?? "0") || 0;
}

export function trialRemaining(): number {
  return Math.max(0, TRIAL_LIMIT - trialUsed());
}

export function bumpTrialUsed() {
  localStorage.setItem(TRIAL_USED_KEY, String(trialUsed() + 1));
  window.dispatchEvent(new Event("siwes-access-change"));
}

export function clearAccess() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TIER_KEY);
  localStorage.removeItem(KIND_KEY);
  localStorage.removeItem(TRIAL_USED_KEY);
  window.dispatchEvent(new Event("siwes-access-change"));
}
