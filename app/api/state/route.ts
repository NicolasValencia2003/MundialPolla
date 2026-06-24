import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { scorePredictions } from "@/lib/scoring";
import { syncResultFromApi } from "@/lib/syncResult";
import type { MatchState, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public read endpoint. This is the ONLY way the browser learns about
// predictions, and it deliberately hides everyone's picks until the final
// score is in — so nobody can copy a relative's guess before kickoff.
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();

  // Family-page-driven auto result: while the match is live, the first poll
  // past the 3-min throttle window checks the football API and records the
  // final score. Best-effort — never let a sync hiccup break the page.
  try {
    await syncResultFromApi();
  } catch {
    /* ignore — manual entry and the admin button remain as backups */
  }

  const { data: stateRow, error: stateErr } = await supabaseAdmin
    .from("match_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (stateErr || !stateRow) {
    return NextResponse.json(
      { error: "Match not configured. Run the SQL schema in Supabase." },
      { status: 500 }
    );
  }
  const state = stateRow as MatchState;

  const { data: predRows } = await supabaseAdmin
    .from("predictions")
    .select("*")
    .order("created_at", { ascending: true });
  const predictions = (predRows ?? []) as Prediction[];

  const now = Date.now();
  const finished = state.final_home !== null && state.final_away !== null;
  const locked = finished || (!!state.kickoff && now >= new Date(state.kickoff).getTime());

  // Base payload always visible: match info, lock state, and the list of names
  // already in (so people know who still needs to play) — but NO scores.
  const base = {
    homeTeam: state.home_team,
    awayTeam: state.away_team,
    kickoff: state.kickoff,
    locked,
    finished,
    participants: predictions.map((p) => p.name),
    count: predictions.length,
  };

  if (!finished) {
    return NextResponse.json(base);
  }

  // Match is over: reveal everything and compute the winner(s).
  const { scored, winners } = scorePredictions(
    predictions,
    state.final_home as number,
    state.final_away as number
  );

  return NextResponse.json({
    ...base,
    finalHome: state.final_home,
    finalAway: state.final_away,
    predictions: scored.map((p) => ({
      name: p.name,
      home_goals: p.home_goals,
      away_goals: p.away_goals,
      distance: p.distance,
      exact: p.exact,
      isWinner: p.isWinner,
    })),
    winners: winners.map((w) => w.name),
    winnerExact: winners.length > 0 && winners[0].exact,
  });
}
