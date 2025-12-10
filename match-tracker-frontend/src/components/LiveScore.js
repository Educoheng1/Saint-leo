// src/components/LiveScore.js
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles.css";
import Footer from "./Footer";
import TopNav from "./Topnav";
import API_BASE_URL from "../config";


/* ---------- utils ---------- */

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function looksLive(m) {
  const st = String(m?.status ?? "").toLowerCase();
  const started = Boolean(m?.started);
  return (
    (st === "live" || st === "in_progress" || st === "in-progress" || started) &&
    st !== "completed"
  );
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
    ? d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
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

/* ---------- set + label helpers ---------- */

const normalizeSets = (sets = [], N = 3) => {
  const s = (sets || []).map((x) => {
    if (Array.isArray(x))
      return { team: Number(x[0] ?? 0), opp: Number(x[1] ?? 0) };
    return {
      team: Number(x.team ?? x.a ?? x.team_score ?? 0),
      opp: Number(x.opp ?? x.b ?? x.opp_score ?? 0),
      super: !!x.super,
    };
  });
  while (s.length < N) s.push({ team: 0, opp: 0 });
  return s.slice(0, N);
};

const setsWonByTeam = (sets) =>
  sets.reduce(
    (acc, s) => acc + ((s.team ?? 0) > (s.opp ?? 0) ? 1 : 0),
    0
  );

const typeLabel = (r) =>
  (r?.match_type || r?.type || "").toLowerCase() === "doubles"
    ? "Doubles"
    : "Singles";

// sideText(r, true) -> opponent names; sideText(r, false) -> Lions team
const sideText = (r, isOpp) => {
  const mt = (r?.match_type || r?.type || "").toLowerCase();
  if (mt === "doubles") {
    const a1 = isOpp ? r.opponent1 : r.player1;
    const a2 = isOpp ? r.opponent2 : r.player2;
    return [a1, a2].filter(Boolean).join(" & ") || "TBD & TBD";
  }
  return (isOpp ? r.opponent1 : r.player1) || "TBD";
};

const gameLabel = (cg) => {
  if (!Array.isArray(cg) || cg.length < 2) return "—";
  return `${cg[0] ?? 0}–${cg[1] ?? 0}`;
};

/* ---------- small UI atoms ---------- */
function StatusChip({ status }) {
  const st = String(status || "").toLowerCase();
  if (st === "live") return <span className="sl-chip sl-chip-live">LIVE</span>;
  if (st === "completed") return <span className="sl-chip">COMPLETED</span>;
  if (st === "scheduled") return <span className="sl-chip">SCHEDULED</span>;
  return (
    <span className="sl-chip">
      {String(status || "STATUS").toUpperCase()}
    </span>
  );
}

function ServeDot({ side }) {
  if (!side) return null;
  return (
    <span
      className={`serve-dot ${
        side === "team" ? "serve-team" : "serve-opp"
      }`}
      title={`${side} serving`}
    />
  );
}

/* ---------- data loaders ---------- */

// NOW RETURNS *ALL* LIVE MATCHES (array)
async function fetchLiveMatches() {
  for (const u of [
    `${API_BASE_URL}/schedule?status=live`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : [d];
    const lives = arr.filter(looksLive);
    if (lives.length) {
      const full = [];
      for (const m of lives) {
        const details = await fetchJSON(`${API_BASE_URL}/matches/${m.id}`);
        full.push(details || m);
      }
      return full;
    }
  }
  return [];
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
      .filter(
        (m) =>
          String(m?.status || "").toLowerCase() !== "completed"
      )
      .filter(
        (m) => parseDateSafe(m?.date)?.getTime() >= Date.now()
      )
      .sort(
        (a, b) =>
          (parseDateSafe(a?.date)?.getTime() ?? 0) -
          (parseDateSafe(b?.date)?.getTime() ?? 0)
      );
    if (future.length) return future[0];
  }
  return null;
}

/* ---------- helpers for each match block ---------- */

function computeDualScore(rows) {
  let teamUnits = 0,
    oppUnits = 0;

  for (const r of rows || []) {
    // use completed lines only (case-insensitive)
    const status = String(r?.status ?? "").toLowerCase().trim();
    if (status !== "completed") continue;

    // doubles = 0.5 pt, singles = 1 pt (2 units = 1 pt)
    const type = String(r?.match_type ?? r?.type ?? "")
      .toLowerCase()
      .trim();
    const units = type === "doubles" ? 1 : 2;

    // normalize winner from all possible formats
    const rawWinner = r?.winner;
    const w = String(rawWinner ?? "").toLowerCase().trim();

    let winner = "";
    if (w === "team" || w === "0") {
      winner = "team";
    } else if (w === "opponent" || w === "1") {
      winner = "opponent";
    }

    if (winner === "team") teamUnits += units;
    else if (winner === "opponent") oppUnits += units;
  }

  // keep your original behavior (ints only)
  return {
    team: Math.floor(teamUnits / 2),
    opp: Math.floor(oppUnits / 2),
  };

  // If later you want to SEE 0.5 for doubles, use this instead:
  // return { team: teamUnits / 2, opp: oppUnits / 2 };
}



/* One full block: header + doubles + singles for ONE match */
function MatchBlock({ match, rows }) {
  const doubles = rows.filter(
    (r) => (r.match_type || "").toLowerCase() === "doubles"
  );
  const singles = rows.filter(
    (r) => (r.match_type || "").toLowerCase() === "singles"
  );

  const dualScore = computeDualScore(rows);

  return (
    <section className="ls-match-block">
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
            {fmtDate(match?.date)}{" "}
            {match?.location ? `• ${match.location}` : ""}
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

      {/* Doubles Section */}
      <h2 className="ls-section-title">Doubles</h2>
      <div className="ls-grid">
        {doubles.length ? (
          doubles.map((r) => {
            const serveSide =
              r.current_serve === 0
                ? "team"
                : r.current_serve === 1
                ? "opp"
                : null;

            const setCols = normalizeSets(r.sets, 3);
            const teamSets = setsWonByTeam(setCols);
            const oppSets = setCols.filter(
              (s) => (s.opp ?? 0) > (s.team ?? 0)
            ).length;
            const teamWins = teamSets > oppSets;
            const oppWins = oppSets > teamSets;

            return (
              <div
                key={r.id}
                className={`ls-line sl-card ${
                  r.status === "completed" ? "ls-line-final" : ""
                }`}
              >
                <div
                  className="ls-line-head"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="ls-line-type">{typeLabel(r)}</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      className="ls-game"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div
                        className="ls-game-label"
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          opacity: 0.6,
                        }}
                      >
                        Game
                      </div>
                      <div
                        className="ls-game-val"
                        style={{
                          fontSize: 14,
                          padding: "2px 8px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                        }}
                      >
                        {gameLabel(r.current_game)}
                      </div>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                </div>

                <div
                  className="ls-line-body"
                  style={{ display: "block", width: "100%" }}
                >
                  {/* TEAM (Lions) */}
                  <div className={`ls-row ${teamWins ? "win" : ""}`}>
                    <div className="ls-row-names">
                      <ServeDot
                        side={serveSide === "team" ? "team" : null}
                      />
                      <div className="min-w-0">
                        <div className="ls-team font-medium truncate">
                          {r.player1 && r.player2
                            ? `${r.player1} & ${r.player2}`
                            : sideText(r, false)}
                        </div>
                        <div className="ls-side-label us-label">
                          Lions
                        </div>
                      </div>
                    </div>
                    <div
                      className="ls-row-sets"
                      style={{ alignSelf: "flex-end" }}
                    >
                      {setCols.map((s, i) => (
                        <div
                          key={i}
                          className={
                            (s.team ?? 0) > (s.opp ?? 0)
                              ? "text-green-700"
                              : "text-gray-900"
                          }
                        >
                          {s.team ?? 0}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OPP */}
                  <div className={`ls-row mt-1 ${oppWins ? "lose" : ""}`}>
                    <div className="ls-row-names">
                      <ServeDot
                        side={serveSide === "opp" ? "opp" : null}
                      />
                      <div className="min-w-0">
                        <div className="ls-opp truncate">
                          {r.opponent1 && r.opponent2
                            ? `${r.opponent1} & ${r.opponent2}`
                            : sideText(r, true)}
                        </div>
                        <div className="ls-side-label opp-label">
                          Opp
                        </div>
                      </div>
                    </div>
                    <div
                      className="ls-row-sets"
                      style={{ alignSelf: "flex-end" }}
                    >
                      {setCols.map((s, i) => (
                        <div
                          key={i}
                          className={
                            (s.opp ?? 0) > (s.team ?? 0)
                              ? "text-red-600"
                              : "text-black"
                          }
                        >
                          {s.opp ?? 0}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="sl-card" style={{ padding: 14 }}>
            No doubles matches yet.
          </div>
        )}
      </div>

      {/* Singles Section */}
      <h2 className="ls-section-title">Singles</h2>
      <div className="ls-grid">
        {singles.length ? (
          singles.map((r) => {
            const serveSide =
              r.current_serve === 0
                ? "team"
                : r.current_serve === 1
                ? "opp"
                : null;

            const setCols = normalizeSets(r.sets, 3);
            const teamSets = setsWonByTeam(setCols);
            const oppSets = setCols.filter(
              (s) => (s.opp ?? 0) > (s.team ?? 0)
            ).length;
            const teamWins = teamSets > oppSets;
            const oppWins = oppSets > teamSets;

            return (
              <div
                key={r.id}
                className={`ls-line sl-card ${
                  r.status === "completed" ? "ls-line-final" : ""
                }`}
              >
                <div
                  className="ls-line-head"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div className="ls-line-type">{typeLabel(r)}</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      className="ls-game"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <div
                        className="ls-game-label"
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          opacity: 0.6,
                        }}
                      >
                        Game
                      </div>
                      <div
                        className="ls-game-val"
                        style={{
                          fontSize: 14,
                          padding: "2px 8px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                        }}
                      >
                        {gameLabel(r.current_game)}
                      </div>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                </div>

                <div
                  className="ls-line-body"
                  style={{ display: "block", width: "100%" }}
                >
                  {/* TEAM (Lions) */}
                  <div className={`ls-row ${teamWins ? "win" : ""}`}>
                    <div className="ls-row-names">
                      <ServeDot
                        side={serveSide === "team" ? "team" : null}
                      />
                      <div className="min-w-0">
                        <div className="ls-team font-medium truncate">
                          {r.player1 ||
                            r.teamA?.player_name ||
                            "Singles Player"}
                        </div>
                        <div className="ls-side-label us-label">
                          Lions
                        </div>
                      </div>
                    </div>
                    <div
                      className="text-lg font-semibold"
                      style={{
                        display: "flex",
                        gap: 12,
                        marginLeft: "auto",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {setCols.map((s, i) => (
                        <div
                          key={i}
                          style={{ minWidth: 20, textAlign: "right" }}
                          className={
                            (s.team ?? 0) > (s.opp ?? 0)
                              ? "text-green-700"
                              : "text-gray-900"
                          }
                        >
                          {s.team ?? 0}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OPP */}
                  <div className={`ls-row mt-1 ${oppWins ? "lose" : ""}`}>
                    <div className="ls-row-names">
                      <ServeDot
                        side={serveSide === "opp" ? "opp" : null}
                      />
                      <div className="min-w-0">
                        <div className="ls-opp truncate">
                          {r.opponent1 ||
                            r.teamB?.player_name ||
                            "Singles Opponent"}
                        </div>
                        <div className="ls-side-label opp-label">
                          Opp
                        </div>
                      </div>
                    </div>
                    <div
                      className="text-lg font-semibold"
                      style={{
                        display: "flex",
                        gap: 12,
                        marginLeft: "auto",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {setCols.map((s, i) => (
                        <div
                          key={i}
                          style={{ minWidth: 20, textAlign: "right" }}
                          className={
                            (s.opp ?? 0) > (s.team ?? 0)
                              ? "text-red-600"
                              : "text-black"
                          }
                        >
                          {s.opp ?? 0}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="sl-card" style={{ padding: 14 }}>
            No singles matches yet.
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   LiveScore Component
========================================================= */
export default function LiveScore() {
  
  const [liveMatches, setLiveMatches] = useState([]); // array of matches
  const [rowsByMatch, setRowsByMatch] = useState({}); // { [matchId]: rows[] }
  const [loading, setLoading] = useState(true);
  const [nextMatch, setNextMatch] = useState(null);

  const hasLive = liveMatches.length > 0;
  const { d, h, m, s } = useCountdown(nextMatch?.date);

  // load live matches + their scores (for each match)
  useEffect(() => {
    let mounted = true;
    console.log("LiveScore load() called");

    const load = async () => {
      setLoading(true);
      const matches = await fetchLiveMatches();
      if (!mounted) return;

      if (matches && matches.length > 0) {
        setLiveMatches(matches);
        setNextMatch(null);

        const scoresMap = {};
        for (const m of matches) {
          const sc = await fetchScores(m.id);
          if (!mounted) return;
          scoresMap[m.id] = sc;
        }
        setRowsByMatch(scoresMap);
      } else {
        setLiveMatches([]);
        setRowsByMatch({});
        const up = await fetchUpcoming();
        if (!mounted) return;
        setNextMatch(up);
      }

      setLoading(false);
    };

  // run only once when component mounts
  load();

  return () => {
    mounted = false;
    // no interval to clear anymore
  };
}, []); // keep deps empty

  return (
    <>
      <TopNav hasLive={hasLive} />

      <div
        className="sl-main"
        style={{ maxWidth: 1100, margin: "16px auto", padding: "0 16px" }}
      >
        <h1 className="sl-welcome">Live Scores</h1>
        <p className="sl-subtitle">Real-time updates for current matches</p>

        {loading ? (
          <div className="sl-card sl-skeleton">Loading…</div>
        ) : hasLive ? (
          <>
            {liveMatches.map((match) => (
              <MatchBlock
                key={match.id}
                match={match}
                rows={rowsByMatch[match.id] || []}
              />
            ))}
          </>
        ) : (
          <div className="sl-next-pretty">
            <div className="sl-next-left">
              <div className="sl-next-title">No live matches right now</div>
              <div className="sl-next-sub">Next match is in:</div>
              {nextMatch?.date ? (
                <div className="sl-countdown">
                  <div className="sl-unit">
                    <span>{String(d).padStart(2, "0")}</span>
                    <small>days</small>
                  </div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit">
                    <span>{String(h).padStart(2, "0")}</span>
                    <small>hrs</small>
                  </div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit">
                    <span>{String(m).padStart(2, "0")}</span>
                    <small>min</small>
                  </div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit">
                    <span>{String(s).padStart(2, "0")}</span>
                    <small>sec</small>
                  </div>
                </div>
              ) : (
                <div className="sl-next-fallback">TBD — check schedule</div>
              )}

              <div className="sl-next-meta">
                {nextMatch?.opponent
                  ? `Lions vs ${nextMatch.opponent}`
                  : "Opponent TBA"}
                {nextMatch?.location ? ` • ${nextMatch.location}` : ""}
              </div>
              <div className="sl-next-date">{fmtDate(nextMatch?.date)}</div>
            </div>

            <div className="sl-next-right">
              <Link className="sl-view-btn" to="/schedule">
                View Schedule
              </Link>
            </div>
          </div>
        )}
<Footer />
      </div>
    </>
  );
}

// keep this export as in your original file
export const ScoreInput = () => null;
