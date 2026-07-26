import { hasServerKey } from "@/lib/kv";

export const runtime = "nodejs";

/** Tells the client whether the owner has provided a working AI key, so it can
 *  stop forcing students to add their own. Returns only a boolean. */
export async function GET() {
  return Response.json({ serverKey: await hasServerKey() });
}
