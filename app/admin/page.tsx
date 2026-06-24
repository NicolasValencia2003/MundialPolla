"use client";

import { useState } from "react";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [homeTeam, setHomeTeam] = useState("Colombia");
  const [awayTeam, setAwayTeam] = useState("RD Congo");
  const [kickoff, setKickoff] = useState("");
  const [finalHome, setFinalHome] = useState("");
  const [finalAway, setFinalAway] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/result", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ password, ...body }),
      });
      const data = await res.json();
      if (!res.ok) setMsg({ type: "err", text: data.error ?? "Error" });
      else setMsg({ type: "ok", text: okText });
    } catch {
      setMsg({ type: "err", text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }

  async function autoSync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { headers: { "x-admin-password": password } });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "Error" });
      } else if (data.finished) {
        setMsg({ type: "ok", text: `¡Resultado sincronizado! ${data.home} - ${data.away}` });
      } else if (data.alreadyFinished) {
        setMsg({ type: "ok", text: "El resultado ya estaba guardado." });
      } else {
        setMsg({ type: "err", text: data.reason ?? "El partido aún no termina según la API." });
      }
    } catch {
      setMsg({ type: "err", text: "Error de red." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="hero">
        <span className="badge">Panel de administrador</span>
        <h1>Polla — Control</h1>
        <p className="sub">Solo para el organizador.</p>
      </div>

      <div className="card">
        <label htmlFor="pw">Contraseña de admin</label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <p className="muted" style={{ marginTop: 8 }}>
          Se pide en cada acción. No se guarda en ningún lado.
        </p>
      </div>

      <div className="card">
        <h2>1 · Marcador final (manual)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Al guardar el marcador, la app revela el ganador para toda la familia.
        </p>
        <div className="score-inputs">
          <div className="col">
            <label>{homeTeam}</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={finalHome}
              onChange={(e) => setFinalHome(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="dash">–</div>
          <div className="col">
            <label>{awayTeam}</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={finalAway}
              onChange={(e) => setFinalAway(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => post({ finalHome, finalAway }, "Marcador guardado. ¡Ganador revelado!")}
        >
          Guardar marcador y revelar
        </button>
        <button
          className="ghost"
          disabled={busy}
          onClick={() => post({ finalHome: null, finalAway: null }, "Marcador borrado (oculto de nuevo).")}
        >
          Borrar marcador (volver a ocultar)
        </button>
      </div>

      <div className="card">
        <h2>2 · Sincronizar desde la API (automático)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Consulta API-Football. Solo guarda el marcador si el partido ya terminó. Requiere las
          variables FOOTBALL_API_KEY y FOOTBALL_FIXTURE_ID.
        </p>
        <button className="primary" disabled={busy} onClick={autoSync}>
          Sincronizar ahora
        </button>
      </div>

      <div className="card">
        <h2>3 · Ajustes del partido</h2>
        <label>Equipo local</label>
        <input type="text" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
        <label style={{ marginTop: 12 }}>Equipo visitante</label>
        <input type="text" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
        <label style={{ marginTop: 12 }}>
          Hora de inicio (cierra las predicciones). Tu hora local.
        </label>
        <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            post(
              {
                homeTeam,
                awayTeam,
                kickoff: kickoff ? new Date(kickoff).toISOString() : null,
              },
              "Ajustes guardados."
            )
          }
        >
          Guardar ajustes
        </button>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="foot">
        <a href="/">← Volver a la polla</a>
      </div>
    </div>
  );
}
