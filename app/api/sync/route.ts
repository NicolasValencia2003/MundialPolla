import { NextRequest, NextResponse } from "next/server";
import { syncResultFromApi } from "@/lib/syncResult";

export const dynamic = "force-dynamic";

// Deliberate result check, triggered from the admin "Sync now" button (or any
// authenticated caller). Forces a fetch, bypassing the time throttle.
// The family page also auto-syncs on its own (see /api/state), so this is a
// manual backup rather than the primary path.
export async function GET(req: NextRequest) {
  const adminPw = req.headers.get("x-admin-password");
  const isAdmin = process.env.ADMIN_PASSWORD && adminPw === process.env.ADMIN_PASSWORD;
  // Also accept a Bearer CRON_SECRET, in case you wire up an external scheduler.
  const auth = req.headers.get("authorization");
  const isCron = process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncResultFromApi({ force: true });

  if (!result.ok && result.reason === "not_configured") {
    return NextResponse.json(
      { ok: false, reason: "FOOTBALL_API_KEY / FOOTBALL_FIXTURE_ID not set; use manual entry." },
      { status: 200 }
    );
  }
  return NextResponse.json(result);
}
