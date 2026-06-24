"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StateResponse = {
  homeTeam: string;
  awayTeam: string;
  kickoff: string | null;
  locked: boolean;
  finished: boolean;
  participants: string[];
  count: number;
  finalHome?: number;
  finalAway?: number;
  predictions?: {
    name: string;
    home_goals: number;
    away_goals: number;
    distance: number;
    exact: boolean;
    isWinner: boolean;
  }[];
  winners?: string[];
  winnerExact?: boolean;
  error?: string;
};

export default function Home() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const nameRef = useRef("");

  // Remember the player's name on this device so re-opening pre-fills it.
  useEffect(() => {
    const saved = localStorage.getItem("polla_name");
    if (saved) {
      setName(saved);
      nameRef.current = saved;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      const data: StateResponse = await res.json();
      setState(data);
    } catch {
      /* keep last known state */
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + poll. Poll faster once the match is locked (waiting for the
  // result) so the reveal feels instant when the score lands.
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, home, away }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo guardar." });
      } else {
        localStorage.setItem("polla_name", name.trim());
        nameRef.current = name.trim();
        setMsg({
          type: "ok",
          text: data.updated ? "¡Predicción actualizada!" : "¡Predicción guardada! Mucha suerte 🍀",
        });
        load();
      }
    } catch {
      setMsg({ type: "err", text: "Error de red. Intenta de nuevo." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !state) {
    return (
      <div className="wrap">
        <div className="spinner" />
      </div>
    );
  }

  if (state?.error) {
    return (
      <div className="wrap">
        <div className="card">
          <h2>Configuración pendiente</h2>
          <p className="muted">{state.error}</p>
        </div>
      </div>
    );
  }

  const s = state!;
  const statusPill = s.finished ? (
    <span className="pill done">Finalizado</span>
  ) : s.locked ? (
    <span className="pill locked">Cerrado · jugando</span>
  ) : (
    <span className="pill open">Abierto</span>
  );

  return (
    <div className="wrap">
      <div className="hero">
        <span className="badge">Polla Mundial · Familia</span>
        <h1>
          {s.homeTeam} <span style={{ color: "var(--muted)" }}>vs</span> {s.awayTeam}
        </h1>
        <p className="sub">Predice el marcador final. Gana el exacto o el más cercano.</p>
      </div>

      <div style={{ textAlign: "center", margin: "8px 0 4px" }}>{statusPill}</div>

      {s.finished && <ResultView s={s} />}

      {!s.finished && s.locked && <LockedView s={s} />}

      {!s.finished && !s.locked && (
        <>
          <div className="card">
            <h2>Tu predicción</h2>
            <form onSubmit={submit}>
              <label htmlFor="name">Tu nombre</label>
              <input
                id="name"
                type="text"
                placeholder="Ej: Tía Marta"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />

              <div className="score-inputs">
                <div className="col">
                  <label>{s.homeTeam}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={30}
                    placeholder="0"
                    value={home}
                    onChange={(e) => setHome(e.target.value)}
                  />
                </div>
                <div className="dash">–</div>
                <div className="col">
                  <label>{s.awayTeam}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={30}
                    placeholder="0"
                    value={away}
                    onChange={(e) => setAway(e.target.value)}
                  />
                </div>
              </div>

              <button className="primary" type="submit" disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar predicción"}
              </button>
              <p className="muted" style={{ textAlign: "center", marginTop: 10 }}>
                Puedes cambiarla cuantas veces quieras hasta que empiece el partido.
              </p>
            </form>
            {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
          </div>

          <div className="card">
            <h2>Ya jugaron ({s.count})</h2>
            {s.count === 0 ? (
              <p className="muted">Nadie todavía. ¡Sé el primero!</p>
            ) : (
              <div className="names">
                {s.participants.map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>
            )}
            <p className="muted" style={{ marginTop: 12 }}>
              🔒 Las predicciones de cada quien quedan ocultas hasta el pitazo final.
            </p>
          </div>
        </>
      )}

      <div className="foot">
        <a href="/admin">Admin</a>
      </div>
    </div>
  );
}

function LockedView({ s }: { s: StateResponse }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <h2>¡El partido está en juego! ⚽</h2>
      <p className="muted">
        Las predicciones están cerradas. Cuando termine el partido, el ganador aparecerá aquí
        automáticamente.
      </p>
      <div className="spinner" />
      <p className="muted">Esperando el marcador final…</p>
      <div className="names" style={{ justifyContent: "center" }}>
        {s.participants.map((p) => (
          <span key={p}>{p}</span>
        ))}
      </div>
    </div>
  );
}

function ResultView({ s }: { s: StateResponse }) {
  const winners = s.winners ?? [];
  const multiple = winners.length > 1;
  return (
    <>
      <div className="scoreline">
        <span className="team">{s.homeTeam}</span>
        <span className="big">{s.finalHome}</span>
        <span className="vs">–</span>
        <span className="big">{s.finalAway}</span>
        <span className="team">{s.awayTeam}</span>
      </div>

      <div className="winner-banner">
        <div className="label">{multiple ? "Ganadores" : "Ganador"} 🏆</div>
        <div className="who">{winners.length ? winners.join(" · ") : "Sin participantes"}</div>
        <div className="how">
          {s.winnerExact
            ? "¡Acertó el marcador exacto!"
            : "Nadie acertó el marcador exacto — gana la predicción más cercana."}
        </div>
      </div>

      <div className="card">
        <h2>Todas las predicciones</h2>
        <table className="results">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Marcador</th>
              <th>Dif.</th>
            </tr>
          </thead>
          <tbody>
            {(s.predictions ?? []).map((p) => (
              <tr key={p.name} className={p.isWinner ? "win" : ""}>
                <td>
                  {p.isWinner && <span className="trophy">🏆 </span>}
                  {p.name}
                </td>
                <td>
                  <span className="score">
                    {p.home_goals} – {p.away_goals}
                  </span>{" "}
                  {p.exact && <span className="trophy">exacto</span>}
                </td>
                <td>{p.distance}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginTop: 10 }}>
          “Dif.” = qué tan lejos quedó del marcador real (suma de goles de diferencia). Menor es
          mejor.
        </p>
      </div>
    </>
  );
}
