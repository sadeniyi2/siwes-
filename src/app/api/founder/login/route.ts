import { NextRequest } from "next/server";
import { signAccess } from "@/lib/token";

export const runtime = "nodejs";

// Founder accounts, set as an env var:
//   FOUNDER_USERS="olive:yourPasscode,peace:herPasscode"
// Only these names + passcodes can open the founder panel.
function founderUsers(): Record<string, string> {
  const map: Record<string, string> = {};
  (process.env.FOUNDER_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const i = pair.indexOf(":");
      if (i > 0) map[pair.slice(0, i).trim().toLowerCase()] = pair.slice(i + 1);
    });
  return map;
}

export async function POST(req: NextRequest) {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    return Response.json(
      { ok: false, message: "Server not configured (ACCESS_TOKEN_SECRET)." },
      { status: 500 },
    );
  }
  const users = founderUsers();
  if (Object.keys(users).length === 0) {
    return Response.json(
      {
        ok: false,
        message:
          "No founder accounts configured. Set FOUNDER_USERS in your environment.",
      },
      { status: 500 },
    );
  }

  let name = "";
  let passcode = "";
  try {
    const b = await req.json();
    name = String(b?.name ?? "").trim().toLowerCase();
    passcode = String(b?.passcode ?? "");
  } catch {
    /* ignore */
  }

  if (!name || !passcode || users[name] !== passcode) {
    return Response.json(
      { ok: false, message: "Wrong name or passcode." },
      { status: 401 },
    );
  }

  const now = Date.now();
  const token = signAccess({
    email: "",
    tier: "pro",
    kind: "paid",
    role: "admin",
    name,
    ref: `admin:${name}`,
    iat: now,
    exp: now + 12 * 60 * 60 * 1000, // 12-hour admin session
  });
  return Response.json({ ok: true, token, name });
}
