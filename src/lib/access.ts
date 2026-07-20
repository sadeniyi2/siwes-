"use client";

import { Tier } from "./plans";

export type { Tier } from "./plans";
export { PLANS, PRO_TRIGGERS, isProAction, type PlanInfo } from "./plans";

export type Kind = "paid" | "free" | "trial";

/** Length of the free trial, in days. */
export const TRIAL_DAYS = 3;

const TOKEN_KEY = "siwes.access.token.v1";
const TIER_KEY = "siwes.access.tier.v1";
const KIND_KEY = "siwes.access.kind.v1";
const TRIAL_EXP_KEY = "siwes.trial.exp.v1";

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

/** Start a trial: store the trial token and its expiry time. */
export function saveTrial(token: string, exp: number) {
  localStorage.setItem(TRIAL_EXP_KEY, String(exp));
  saveAccess(token, "basic", "trial");
}

export function trialExpiry(): number | null {
  if (typeof window === "undefined") return null;
  const v = Number(localStorage.getItem(TRIAL_EXP_KEY) ?? "");
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Whole days left in the trial (rounded up), 0 if expired/unknown. */
export function trialDaysLeft(): number {
  const exp = trialExpiry();
  if (!exp) return 0;
  return Math.max(0, Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function trialExpired(): boolean {
  const exp = trialExpiry();
  return exp !== null && Date.now() > exp;
}

export function clearAccess() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TIER_KEY);
  localStorage.removeItem(KIND_KEY);
  localStorage.removeItem(TRIAL_EXP_KEY);
  window.dispatchEvent(new Event("siwes-access-change"));
}
