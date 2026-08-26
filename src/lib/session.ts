import "server-only";
import { signAccess, verifyAccess, Tier } from "./token";
import { getAccount, kvConfigured, updateAccount, type Account } from "./kv";

// A login session lasts 90 days; the app refreshes it whenever the user opens
// it, so active students stay signed in. Trial tokens still expire at trial end.
const SESSION_MS = 90 * 24 * 60 * 60 * 1000;

export interface IssuedToken {
  token: string;
  tier?: Tier;
  kind?: string;
  exp: number;
  hasAccess: boolean;
}

/** Mint a login token that reflects the account's current access. */
export function issueAccountToken(acc: Account): IssuedToken {
  const now = Date.now();
  const onTrial = acc.kind === "trial" && (acc.trialExp ?? 0) > now;

  let tier: Tier | undefined;
  let kind: "paid" | "free" | "trial" | undefined;
  let exp: number;

  if (onTrial) {
    tier = acc.tier === "pro" ? "pro" : "basic";
    kind = "trial";
    exp = acc.trialExp as number;
  } else if (acc.tier === "basic" || acc.tier === "pro") {
    tier = acc.tier;
    kind = acc.kind === "free" ? "free" : "paid";
    exp = now + SESSION_MS;
  } else {
    // Logged in, but no access yet (needs a trial/payment/code).
    exp = now + SESSION_MS;
  }

  const token = signAccess({
    email: acc.email,
    name: acc.name,
    tier,
    kind,
    ref: `acct:${acc.email}`,
    iat: now,
    exp,
  });
  return { token, tier, kind, exp, hasAccess: !!tier };
}

/**
 * When an access grant (trial / payment / code) comes from a logged-in account,
 * write the new access onto that account row and mint a fresh account token, so
 * the access follows the student to any device. Returns null when there is no
 * account to attach to (anonymous flow), letting the caller fall back to a
 * plain token.
 */
export async function grantToAccount(
  sessionToken: string | null | undefined,
  grant: {
    tier: Tier;
    kind: "paid" | "free" | "trial";
    trialExp?: number | null;
  },
): Promise<{ token: string; email: string } | null> {
  if (!kvConfigured()) return null;
  const claims = verifyAccess(sessionToken);
  if (!claims?.email || claims.role === "admin") return null;
  const acc = await getAccount(claims.email);
  if (!acc) return null;
  await updateAccount(claims.email, {
    tier: grant.tier,
    kind: grant.kind,
    trialExp: grant.trialExp ?? null,
  });
  const updated = (await getAccount(claims.email)) ?? {
    ...acc,
    tier: grant.tier,
    kind: grant.kind,
    trialExp: grant.trialExp ?? undefined,
  };
  return { token: issueAccountToken(updated).token, email: claims.email };
}
