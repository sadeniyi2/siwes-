import { NextRequest } from "next/server";
import { signAccess } from "@/lib/token";

export const runtime = "nodejs";

// People who get full Pro access for free — matched by name on the login page.
const FREE_PRO_NAMES = [
  "Adeniyi Oluwademiladeayo Samuel",
  "Ogunmokun Ayomide",
  "Oyebamire Oluwaseun",
];

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Forgiving match: word order doesn't matter, and a shorter name still matches
 *  as long as every word it has is part of an allowed name (min 2 words). */
function isAllowed(input: string): boolean {
  const a = new Set(words(input));
  if (a.size === 0) return false;
  return FREE_PRO_NAMES.some((name) => {
    const b = new Set(words(name));
    if (b.size === 0) return false;
    const common = [...b].filter((w) => a.has(w)).length;
    const minSize = Math.min(a.size, b.size);
    return common >= 2 && common === minSize;
  });
}

export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      {
        ok: false,
        message: "Access is not configured yet (ACCESS_TOKEN_SECRET is missing).",
      },
      { status: 500 },
    );
  }

  let name = "";
  try {
    const body = await req.json();
    name = String(body?.name ?? "");
  } catch {
    /* ignore */
  }

  if (!isAllowed(name)) {
    return Response.json(
      { ok: false, message: "That name isn't on the free-access list." },
      { status: 403 },
    );
  }

  const token = signAccess({
    email: "",
    tier: "pro",
    ref: `free:${name.trim().slice(0, 40)}`,
    iat: Date.now(),
  });
  return Response.json({ ok: true, token, tier: "pro" });
}
