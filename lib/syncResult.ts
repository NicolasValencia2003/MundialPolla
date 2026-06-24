import { getSupabaseAdmin } from "./supabase";

// API-Football status codes that mean the match has truly finished.
const FINISHED = new Set(["FT", "AET", "PEN"]);

// Minimum gap between real calls to the football API. The family page polls
// every 15s across many phones, so we throttle globally (via match_state's
// updated_at) to protect the free-tier 100-calls/day quota.
const THROTTLE_MS = 180_000; // 3 minutes

export type SyncOutcome = {
  ok: boolean;
  finished?: boolean;
  status?: string;
  home?: number | null;
  away?: number | null;
  skipped?: boolean;
  reason?: string;
};

// Checks API-Football for the configured fixture and, if the match is over,
// writes the final score into match_state (which triggers the reveal).
//
// Safe to call on every page load: it self-guards and returns cheaply when
// the API isn't configured, the result is already in, the match hasn't kicked
// off, or we synced too recently. Pass { force: true } from a deliberate
// admin/cron trigger to bypass the time-based throttle.
export async function syncResultFromApi(opts: { force?: boolean } = {}): Promise<SyncOutcome> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  const fixtureId = process.env.FOOTBALL_FIXTURE_ID;
  if (!apiKey || !fixtureId) {
    return { ok: false, reason: "not_configured" };
  }

  const db = getSupabaseAdmin();
  const { data: row } = await db
    .from("match_state")
    .select("final_home, kickoff, updated_at")
    .eq("id", 1)
    .single();
  if (!row) return { ok: false, reason: "no_state" };

  // Result already recorded — nothing to do.
  if (row.final_home !== null) {
    return { ok: true, finished: true, skipped: true, reason: "already_set" };
  }

  const now = Date.now();
  if (!opts.force) {
    if (row.kickoff && now < new Date(row.kickoff).getTime()) {
      return { ok: true, finished: false, skipped: true, reason: "before_kickoff" };
    }
    if (row.updated_at && now - new Date(row.updated_at).getTime() < THROTTLE_MS) {
      return { ok: true, finished: false, skipped: true, reason: "throttled" };
    }
  }

  // Reserve the throttle window immediately so concurrent callers don't all
  // fire at once. (Worst case under a race: a couple of extra calls.)
  await db.from("match_state").update({ updated_at: new Date().toISOString() }).eq("id", 1);

  let res: Response;
  try {
    res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!res.ok) return { ok: false, reason: `api_${res.status}` };

  const data = await res.json();
  const fixture = data?.response?.[0];
  if (!fixture) return { ok: false, reason: "fixture_not_found" };

  const status: string = fixture.fixture?.status?.short ?? "";
  const home: number | null = fixture.goals?.home ?? null;
  const away: number | null = fixture.goals?.away ?? null;

  if (!FINISHED.has(status) || home === null || away === null) {
    return { ok: true, finished: false, status, home, away };
  }

  await db
    .from("match_state")
    .update({ final_home: home, final_away: away, updated_at: new Date().toISOString() })
    .eq("id", 1);

  return { ok: true, finished: true, status, home, away };
}
