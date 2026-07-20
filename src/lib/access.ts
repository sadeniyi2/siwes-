"use client";

import { Tier } from "./plans";

export type { Tier } from "./plans";
export { PLANS, PRO_TRIGGERS, isProAction, type PlanInfo } from "./plans";

const TOKEN_KEY = "siwes.access.token.v1";
const TIER_KEY = "siwes.access.tier.v1";

export function loadAccessToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function loadTier(): Tier | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem(TIER_KEY);
  return t === "basic" || t === "pro" ? t : null;
}

export function saveAccess(token: string, tier: Tier) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TIER_KEY, tier);
  window.dispatchEvent(new Event("siwes-access-change"));
}

export function clearAccess() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TIER_KEY);
  window.dispatchEvent(new Event("siwes-access-change"));
}
