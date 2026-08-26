import "server-only";
import crypto from "crypto";

export type Tier = "basic" | "pro";

export type Kind = "paid" | "free" | "trial";

export interface AccessClaims {
  email: string;
  /** Access tier. Absent = a logged-in session with no paid access yet. */
  tier?: Tier;
  ref: string;
  iat: number;
  kind?: Kind;
  /** Optional expiry (ms epoch) — used for trials and login sessions. */
  exp?: number;
  /** Set to "admin" for founder-panel sessions. */
  role?: "admin";
  /** Display name (student's name, or founder name). */
  name?: string;
}

/** True when the claims carry real app access (a paid/trial/free tier). */
export function hasAccess(claims: AccessClaims | null): boolean {
  return !!claims && (claims.tier === "basic" || claims.tier === "pro");
}

const SECRET = process.env.ACCESS_TOKEN_SECRET || "";

/**
 * Signed, tamper-proof access token (HMAC-SHA256). Minted server-side only
 * after Paystack confirms a successful payment, so it can't be forged by a
 * client that never paid.
 */
export function signAccess(claims: AccessClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAccess(token: string | null | undefined): AccessClaims | null {
  if (!SECRET || !token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as AccessClaims;
    // Reject expired trial tokens.
    if (typeof claims.exp === "number" && Date.now() > claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
