import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MatchState, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

function cleanGoals(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 30) return null;
  return n;
}

// Submit or update a prediction. Allowed only while the match is open
// (before kickoff and before a final score exists). One row per name.
export async function POST(req: NextRequest) {
  let body: { name?: string; home?: unknown; away?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim();
  const home = cleanGoals(body.home);
  const away = cleanGoals(body.away);

  if (name.length < 2 || name.length > 40) {
    return NextResponse.json({ error: "Escribe un nombre válido (2-40 letras)." }, { status: 400 });
  }
  if (home === null || away === null) {
    return NextResponse.json({ error: "Marcador inválido (usa números de 0 a 30)." }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Check the match is still open.
  const { data: stateRow } = await supabaseAdmin
    .from("match_state")
    .select("*")
    .eq("id", 1)
    .single();
  const state = stateRow as MatchState | null;
  if (!state) {
    return NextResponse.json({ error: "Partido no configurado." }, { status: 500 });
  }
  const finished = state.final_home !== null && state.final_away !== null;
  const locked = finished || (!!state.kickoff && Date.now() >= new Date(state.kickoff).getTime());
  if (locked) {
    return NextResponse.json(
      { error: "Las predicciones están cerradas (el partido ya comenzó)." },
      { status: 403 }
    );
  }

  // Upsert by case-insensitive name. Look for an existing row first.
  const { data: existing } = await supabaseAdmin
    .from("predictions")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existing) {
    const { error } = await supabaseAdmin
      .from("predictions")
      .update({ name, home_goals: home, away_goals: away })
      .eq("id", (existing as Prediction).id);
    if (error) {
      return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: true });
  }

  const { error } = await supabaseAdmin
    .from("predictions")
    .insert({ name, home_goals: home, away_goals: away });
  if (error) {
    // Unique-index race: someone inserted the same name a moment ago.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ese nombre ya tiene una predicción." }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: false });
}
