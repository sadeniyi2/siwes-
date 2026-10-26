import { pingStore } from "@/lib/kv";

export const runtime = "nodejs";

/**
 * Health check. A daily Vercel cron hits this so the Supabase project registers
 * activity and doesn't pause (free-tier projects pause after ~7 days idle).
 * Also handy to eyeball whether the database is reachable right now.
 */
export async function GET() {
  const db = await pingStore();
  return Response.json(
    { ok: true, time: new Date().toISOString(), db },
    { status: 200 },
  );
}
