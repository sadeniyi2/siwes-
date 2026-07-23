import { NextRequest } from "next/server";
import { signAccess } from "@/lib/token";
import {
  isBlocked,
  kvConfigured,
  normalizeMatric,
  recordTrial,
  trialCountForIp,
  trialExistsForMatric,
} from "@/lib/kv";

export const runtime = "nodejs";

const TRIAL_DAYS = 3;
// Max trials allowed per IP within 24h. Kept lenient because many students share
// one IP (campus WiFi / mobile CGNAT). Tune with TRIAL_IP_LIMIT; set very high to
// effectively disable IP throttling. The hard block is one trial per matric.
const IP_LIMIT = Number(process.env.TRIAL_IP_LIMIT || "8");

/** Best-effort client IP from the proxy headers (Vercel sets x-forwarded-for). */
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  return (
    first ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-vercel-forwarded-for") ||
    ""
  );
}

/**
 * Mint a Basic-level trial token. A matric number is REQUIRED and each matric
 * (and, softly, each IP) may only take one trial — enforced server-side via
 * Supabase so clearing storage, incognito, or a new device can't get another.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      { ok: false, message: "Access is not configured yet." },
      { status: 500 },
    );
  }

  let matricRaw = "";
  let name = "";
  try {
    const body = await req.json();
    matricRaw = String(body?.matric ?? "");
    name = String(body?.name ?? "").trim().slice(0, 120);
  } catch {
    /* ignore */
  }

  const matric = normalizeMatric(matricRaw);
  // Basic shape check: a real matric/reg number has a few characters.
  if (matric.length < 4 || matric.length > 40) {
    return Response.json(
      {
        ok: false,
        reason: "matric_required",
        message:
          "Please enter your matric / registration number to start the free trial.",
      },
      { status: 400 },
    );
  }

  if (!kvConfigured()) {
    // Without a store we can't reliably de-duplicate. Tell the owner to set it
    // up rather than silently allow unlimited trials.
    return Response.json(
      {
        ok: false,
        reason: "not_ready",
        message:
          "The free trial isn't available right now. Please choose a plan, or try again later.",
      },
      { status: 503 },
    );
  }

  const ip = clientIp(req);

  // Blocklist — a banned matric or IP can never take a trial.
  if (await isBlocked(matric, ip)) {
    return Response.json(
      {
        ok: false,
        reason: "blocked",
        message:
          "This account isn't eligible for the free trial. Please choose a plan, or contact support if you think this is a mistake.",
      },
      { status: 403 },
    );
  }

  // One trial per matric number — the hard block.
  if (await trialExistsForMatric(matric)) {
    return Response.json(
      {
        ok: false,
        reason: "matric_used",
        message:
          "This matric number has already used its free trial. Please choose a plan to continue.",
      },
      { status: 409 },
    );
  }

  // Soft IP throttle to stop one person inventing many matric numbers.
  const since = Date.now() - 24 * 60 * 60 * 1000;
  if (ip && (await trialCountForIp(ip, since)) >= IP_LIMIT) {
    return Response.json(
      {
        ok: false,
        reason: "ip_limit",
        message:
          "Too many free trials have been started from this network today. Please choose a plan, or try again tomorrow.",
      },
      { status: 429 },
    );
  }

  const now = Date.now();
  const exp = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;

  // Record BEFORE issuing so a race can't mint two tokens for one matric.
  await recordTrial(matric, ip, name, exp);

  const token = signAccess({
    email: "",
    tier: "basic",
    kind: "trial",
    ref: `trial:${matric}`,
    iat: now,
    exp,
  });
  return Response.json({ ok: true, token, tier: "basic", kind: "trial", exp });
}
