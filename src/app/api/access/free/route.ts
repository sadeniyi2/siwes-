import { NextRequest } from "next/server";
import { signAccess } from "@/lib/token";

export const runtime = "nodejs";

// People who get full Pro access for free — matched by name on the login page.
// You can add more names WITHOUT editing code by setting the FREE_ACCESS_NAMES
// env var (comma or semicolon separated), e.g. "Jane Doe, John Smith".
const BUILTIN_FREE_NAMES = [
  "Adeniyi Oluwademiladeayo Samuel",
  "Ogunmokun Ayomide",
  "Oyebamire Oluwaseun",
];

function freeNames(): string[] {
  const fromEnv = (process.env.FREE_ACCESS_NAMES || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...BUILTIN_FREE_NAMES, ...fromEnv];
}

function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Forgiving match: word order doesn't matter, titles/extra words are ignored,
 *  and even a mistyped word is tolerated — a name matches an allowed entry when
 *  at least 2 of its words match and they cover ~60%+ of the allowed name. This
 *  handles a misspelled long middle name (e.g. "Oluwademiladeayo") gracefully. */
function isAllowed(input: string): boolean {
  const a = new Set(words(input));
  if (a.size === 0) return false;
  return freeNames().some((name) => {
    const b = words(name);
    if (b.length === 0) return false;
    const common = b.filter((w) => a.has(w)).length;
    if (b.length === 1) return common === 1; // single-word name → exact word
    const needed = Math.max(2, Math.ceil(b.length * 0.6));
    return common >= needed;
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
    kind: "free",
    ref: `free:${name.trim().slice(0, 40)}`,
    iat: Date.now(),
  });
  return Response.json({ ok: true, token, tier: "pro", kind: "free" });
}
