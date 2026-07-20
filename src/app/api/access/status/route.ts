import { NextRequest } from "next/server";
import { verifyAccess } from "@/lib/token";

export const runtime = "nodejs";

/** Tell the client whether a stored access token is genuine, and which tier. */
export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = await req.json();
    token = body?.token ?? "";
  } catch {
    /* ignore */
  }

  const claims = verifyAccess(token);
  if (!claims) {
    return Response.json({ valid: false });
  }
  return Response.json({ valid: true, tier: claims.tier, email: claims.email });
}
