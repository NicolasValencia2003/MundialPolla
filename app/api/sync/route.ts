import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Status codes from API-Football that mean the match has truly finished.
const FINISHED = new Set(["FT", "AET", "PEN"]);

// Polls API-Football for the configured fixture. If the match is over, it
// writes the final score into match_state, which triggers the reveal.
// Called by Vercel Cron (Bearer CRON_SECRET) or manually from the admin page.
export async function GET(req: NextRequest) {
  // Auth: allow either the Vercel Cron bearer token or the admin password.
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const adminPw = req.headers.get("x-admin-password");
  const isCron = cronSecret && auth === `Bearer ${cronSecret}`;
  const isAdmin = process.env.ADMIN_PASSWORD && adminPw === process.env.ADMIN_PASSWORD;
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_API_KEY;
  const fixtureId = process.env.FOOTBALL_FIXTURE_ID;
  if (!apiKey || !fixtureId) {
    return NextResponse.json(
      { ok: false, reason: "FOOTBALL_API_KEY or FOOTBALL_FIXTURE_ID not set; use manual entry." },
      { status: 200 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Don't overwrite a score that's already set.
  const { data: stateRow } = await supabaseAdmin
    .from("match_state")
    .select("final_home, final_away, kickoff")
    .eq("id", 1)
    .single();
  if (stateRow && stateRow.final_home !== null) {
    return NextResponse.json({ ok: true, alreadyFinished: true });
  }

  // Quota guard: API-Football's free tier allows ~100 calls/day, but the cron
  // ticks every couple of minutes around the clock. Don't spend a call until
  // the match has actually kicked off — there's no result to fetch before then.
  // (The admin "Sync now" button bypasses this, since it's a deliberate check.)
  const isAdminCall = process.env.ADMIN_PASSWORD && adminPw === process.env.ADMIN_PASSWORD;
  if (!isAdminCall && stateRow?.kickoff && Date.now() < new Date(stateRow.kickoff).getTime()) {
    return NextResponse.json({ ok: true, finished: false, reason: "Match has not kicked off yet." });
  }

  let res: Response;
  try {
    res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "Football API unreachable." }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ ok: false, reason: `Football API ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  const fixture = data?.response?.[0];
  if (!fixture) {
    return NextResponse.json({ ok: false, reason: "Fixture not found." }, { status: 200 });
  }

  const status: string = fixture.fixture?.status?.short ?? "";
  const home: number | null = fixture.goals?.home ?? null;
  const away: number | null = fixture.goals?.away ?? null;

  if (!FINISHED.has(status) || home === null || away === null) {
    return NextResponse.json({ ok: true, finished: false, status, home, away });
  }

  const { error } = await supabaseAdmin
    .from("match_state")
    .update({ final_home: home, final_away: away, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) {
    return NextResponse.json({ ok: false, reason: "DB write failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, finished: true, home, away });
}
