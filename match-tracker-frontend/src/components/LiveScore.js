// src/pages/LiveScore.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles.css";
import API_BASE_URL from "../config";
import { useAdmin } from "../AdminContext";


export function ScoreInput(props) {
  const initial =
    props.value ??
    props.currentGame ??
    props.current_game ??
    [0, 0];

  const [a, b] = Array.isArray(initial) ? initial : [0, 0];
  const vals = [0, 15, 30, 40];

  const callChange = (next) => {
    if (props.onChange) return props.onChange(next);
    if (props.onChangeCurrentGame) return props.onChangeCurrentGame(next);
    if (props.setValue) return props.setValue(next);
    if (props.setCurrentGame) return props.setCurrentGame(next);
  };

  const setA = (v) => callChange([Number(v), b]);
  const setB = (v) => callChange([a, Number(v)]);

  return (
    <div className="score-input">
      {props.label && <div className="score-input-label">{props.label}</div>}
      <div className="score-input-row">
        <select disabled={props.disabled} value={a} onChange={(e) => setA(e.target.value)} aria-label="Team game points">
          {vals.map((v) => (<option key={v} value={v}>{v}</option>))}
        </select>
        <span className="score-input-sep">–</span>
        <select disabled={props.disabled} value={b} onChange={(e) => setB(e.target.value)} aria-label="Opponent game points">
          {vals.map((v) => (<option key={v} value={v}>{v}</option>))}
        </select>
      </div>
    </div>
  );
}


/* ---------- Top Nav (same look/feel) ---------- */
function TopNav({ name, hasLive }) {
  return (
    <header className="sl-topnav">
      <div className="sl-brand">
        <img src="/saint-leo-logo.png" alt="Saint Leo" />
        <div className="sl-brand-text">
          <span className="sl-brand-title">Saint Leo</span>
          <span className="sl-brand-sub">Tennis</span>
        </div>
      </div>

      <nav className="sl-navlinks">
        <Link to="/dashboard" className="sl-navlink">Dashboard</Link>
        <Link to="/players" className="sl-navlink">Roster</Link>
        <Link to="/schedule" className="sl-navlink">Schedule</Link>
        {hasLive && <Link to="/livescore" className="sl-navlink sl-navlink-accent">Live Scores</Link>}
        {!hasLive && <Link to="/livescore" className="sl-navlink">Scores</Link>}
        <Link to="/admin" className="sl-navlink">Admin Panel</Link>
      </nav>

      <div className="sl-userbox">
        <span className="sl-username">{name}</span>
        <button className="sl-logout" onClick={() => { localStorage.clear(); }}>
          Logout
        </button>
      </div>
    </header>
  );
}

/* ---------- utils ---------- */
const TOKEN = localStorage.getItem("token") || "";
async function fetchJSON(url) {
  try {
    const r = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
function looksLive(m) {
  const st = String(m?.status ?? "").toLowerCase();
  const started = Boolean(m?.started);
  return (st === "live" || st === "in_progress" || st === "in-progress" || started) && st !== "completed";
}
function parseDateSafe(s) {
  if (!s) return null;
  const clean = String(s).replace(" ", "T").replace(/\.\d+$/, "");
  const d = new Date(clean);
  return Number.isNaN(d.getTime()) ? null : d;
}
const fmtDate = (iso) => {
  const d = parseDateSafe(iso);
  return d
    ? d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "TBD";
};
function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  const target = iso ? parseDateSafe(iso)?.getTime() ?? 0 : 0;
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

// set helpers
const toSetsArray = (sets) => {
  if (!Array.isArray(sets)) return [];
  if (Array.isArray(sets[0])) return sets.map(p => ({ team: +(p[0] ?? 0), opp: +(p[1] ?? 0) }));
  return sets.map(s => ({ team: +(s.team ?? 0), opp: +(s.opp ?? 0) }));
};
const setsToChips = (sets) => toSetsArray(sets);
const typeLabel = (s) => `${(s.match_type || "").toLowerCase() === "doubles" ? "Doubles" : "Singles"} ${s.line_no ?? ""}`.trim();
const sideText = (s, opp=false) => {
  const a1 = opp ? s.opponent1 : s.player1;
  const a2 = opp ? s.opponent2 : s.player2;
  if ((s.match_type || "").toLowerCase() === "doubles") return [a1, a2].filter(Boolean).join(" & ") || "TBD & TBD";
  return a1 || "TBD";
};
const gameLabel = (cg) => {
  if (!Array.isArray(cg) || cg.length < 2) return "—";
  return `${cg[0] ?? 0}–${cg[1] ?? 0}`; // your backend already sends 0/15/30/40
};

/* ---------- data loaders ---------- */
async function fetchLiveMatch() {
  for (const u of [
    `${API_BASE_URL}/schedule?status=live`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : [d];
    const found = arr.find(looksLive);
    if (found) {
      const full = await fetchJSON(`${API_BASE_URL}/matches/${found.id}`);
      return full || found;
    }
  }
  return null;
}
async function fetchScores(matchId) {
  const d = await fetchJSON(`${API_BASE_URL}/matches/${matchId}/scores`);
  return Array.isArray(d) ? d : [];
}
async function fetchUpcoming() {
  for (const u of [
    `${API_BASE_URL}/schedule/upcoming`,
    `${API_BASE_URL}/schedule?status=scheduled`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : [d];
    const future = arr
      .filter(m => String(m?.status || "").toLowerCase() !== "completed")
      .filter(m => parseDateSafe(m?.date)?.getTime() >= Date.now())
      .sort((a,b) => (parseDateSafe(a?.date)?.getTime() ?? 0) - (parseDateSafe(b?.date)?.getTime() ?? 0));
    if (future.length) return future[0];
  }
  return null;
}

/* ---------- small UI atoms ---------- */
function StatusChip({ status }) {
  const st = String(status || "").toLowerCase();
  if (st === "live") return <span className="sl-chip sl-chip-live">LIVE</span>;
  if (st === "completed") return <span className="sl-chip">COMPLETED</span>;
  if (st === "scheduled") return <span className="sl-chip">SCHEDULED</span>;
  return <span className="sl-chip">{String(status || "STATUS").toUpperCase()}</span>;
}
function ServeDot({ side }) {
  // side: "team" | "opp" | null
  if (!side) return null;
  return <span className={`serve-dot ${side === "team" ? "serve-team" : "serve-opp"}`} title={`${side} serving`} />;
}

/* ---------- main component ---------- */
export default function LiveScore() {
  const { isAdmin } = useAdmin();
  const guestName = localStorage.getItem("guestName") || (isAdmin ? "Admin" : "Guest");

  const [match, setMatch] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextMatch, setNextMatch] = useState(null);

  const hasLive = !!match;

  // compute dual score (completed lines only)
  const dualScore = useMemo(() => {
    let team = 0, opp = 0;
    for (const r of rows) {
      const w = String(r?.winner || "").toLowerCase();
      if (w === "team") team++;
      else if (w === "opponent") opp++;
    }
    return { team, opp };
  }, [rows]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const m = await fetchLiveMatch();
      if (!mounted) return;
      if (m?.id) {
        setMatch(m);
        const sc = await fetchScores(m.id);
        if (!mounted) return;
        setRows(sc);
      } else {
        setMatch(null);
        const up = await fetchUpcoming();
        if (!mounted) return;
        setNextMatch(up);
      }
      setLoading(false);
    })();

    const t = setInterval(async () => {
      const m = await fetchLiveMatch();
      if (!mounted) return;
      if (m?.id) {
        setMatch(m);
        const sc = await fetchScores(m.id);
        if (!mounted) return;
        setRows(sc);
      } else {
        setMatch(null);
      }
    }, 5000);

    return () => { mounted = false; clearInterval(t); };
  }, []);

  /* countdown for empty state */
  const { d, h, m: mm, s } = useCountdown(nextMatch?.date);

  
  return (
    <>
      <TopNav name={guestName} hasLive={hasLive} />

      <div className="sl-main" style={{ maxWidth: 1100, margin: "16px auto", padding: "0 16px" }}>
        <h1 className="sl-welcome">Live Scores</h1>
        <p className="sl-subtitle">Real-time updates for current matches</p>

        {loading ? (
          <div className="sl-card sl-skeleton">Loading…</div>
        ) : hasLive ? (
          <>
            {/* Header scoreboard */}
            <div className="ls-header sl-card">
              <div className="ls-left">
                <div className="ls-kicker">
                  <span className="sl-live-dot">•</span> Live match in progress
                </div>
                <div className="ls-title">
                  {match?.opponent ? `Lions vs ${match.opponent}` : "Live Match"}
                </div>
                <div className="ls-meta">
                  {fmtDate(match?.date)} {match?.location ? `• ${match.location}` : ""}
                </div>
              </div>
              <div className="ls-right">
                <div className="ls-scorebox">
                  <div className="ls-score">{dualScore.team}</div>
                  <div className="ls-score-sep">–</div>
                  <div className="ls-score">{dualScore.opp}</div>
                  <div className="ls-score-label">Team Points</div>
                </div>
              </div>
            </div>

            {/* Lines grid */}
            <div className="ls-grid">
              {rows.map((r) => {
                const sets = setsToChips(r.sets);
                const serveSide = r.current_serve === 0 ? "team" : r.current_serve === 1 ? "opp" : null;
                return (
                  <div key={r.id} className="ls-line sl-card">
                    <div className="ls-line-head">
                      <div className="ls-line-type">{typeLabel(r)}</div>
                      <StatusChip status={r.status} />
                    </div>

                    <div className="ls-line-body">
                      <div className="ls-side">
                        <div className="ls-names">
                          <ServeDot side={serveSide === "team" ? "team" : null} />
                          <span className="ls-team">{sideText(r, false)}</span>
                        </div>
                        <div className="ls-names">
                          <ServeDot side={serveSide === "opp" ? "opp" : null} />
                          <span className="ls-opp">{sideText(r, true)}</span>
                        </div>
                      </div>

                      <div className="ls-sets">
                        {sets.length ? sets.map((s, i) => (
                          <span key={i} className="set-chip">{s.team}–{s.opp}</span>
                        )) : <span className="set-chip set-empty">—</span>}
                      </div>

                      <div className="ls-game">
                        <div className="ls-game-label">Game</div>
                        <div className="ls-game-val">{gameLabel(r.current_game)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!rows.length && (
                <div className="sl-card" style={{ padding: 14 }}>
                  No individual lines yet. As scores are entered, they’ll appear here.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="sl-next-pretty">
            <div className="sl-next-left">
              <div className="sl-next-title">No live matches right now</div>
              <div className="sl-next-sub">Next match is in:</div>
              {nextMatch?.date ? (
                <div className="sl-countdown">
                  <div className="sl-unit"><span>{String(d).padStart(2,"0")}</span><small>days</small></div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit"><span>{String(h).padStart(2,"0")}</span><small>hrs</small></div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit"><span>{String(mm).padStart(2,"0")}</span><small>min</small></div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit"><span>{String(s).padStart(2,"0")}</span><small>sec</small></div>
                </div>
              ) : (
                <div className="sl-next-fallback">TBD — check schedule</div>
              )}

              <div className="sl-next-meta">
                {nextMatch?.opponent ? `Lions vs ${nextMatch.opponent}` : "Opponent TBA"}
                {nextMatch?.location ? ` • ${nextMatch.location}` : ""}
              </div>
              <div className="sl-next-date">{fmtDate(nextMatch?.date)}</div>
            </div>

            <div className="sl-next-right">
              <Link className="sl-view-btn" to="/schedule">View Schedule</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
