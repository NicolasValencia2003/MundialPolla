import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function checkAdmin(req: NextRequest, bodyPassword?: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const header = req.headers.get("x-admin-password");
  return header === expected || bodyPassword === expected;
}

function cleanGoals(v: unknown): number | null {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 30) return null;
  return n;
}

// Admin endpoint: set the final score manually and/or update match settings
// (team names, kickoff time). Pass final score = null/empty to clear it
// (re-opens the reveal). Protected by ADMIN_PASSWORD.
export async function POST(req: NextRequest) {
  let body: {
    password?: string;
    finalHome?: unknown;
    finalAway?: unknown;
    homeTeam?: string;
    awayTeam?: string;
    kickoff?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!checkAdmin(req, body.password)) {
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("finalHome" in body || "finalAway" in body) {
    const fh = cleanGoals(body.finalHome);
    const fa = cleanGoals(body.finalAway);
    // Both must be set together, or both cleared.
    if ((fh === null) !== (fa === null)) {
      return NextResponse.json(
        { error: "Ingresa ambos marcadores (o deja ambos vacíos para borrar)." },
        { status: 400 }
      );
    }
    update.final_home = fh;
    update.final_away = fa;
  }

  if (typeof body.homeTeam === "string" && body.homeTeam.trim()) {
    update.home_team = body.homeTeam.trim();
  }
  if (typeof body.awayTeam === "string" && body.awayTeam.trim()) {
    update.away_team = body.awayTeam.trim();
  }
  if ("kickoff" in body) {
    update.kickoff = body.kickoff ? new Date(body.kickoff as string).toISOString() : null;
  }

  const { error } = await getSupabaseAdmin().from("match_state").update(update).eq("id", 1);
  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
