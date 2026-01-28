import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";

import API_BASE_URL from "../config";
import BackButton from "../components/BackButton";
import TopNav from "../components/Topnav";
import Footer from "../components/Footer";
import { useAuth } from "../AuthContext";

export default function BoxScorePage() {
  const { id } = useParams();
  const { user, logout } = useAuth?.() || {};

  const [matches, setMatches] = useState([]);
  const [scheduleMatch, setScheduleMatch] = useState(null);

  // ---------- helpers ----------

  function isDoublesMatch(m) {
    const type = String(
      m.matchType || m.match_type || m.event_type || m.type || ""
    ).toLowerCase();
    if (type.includes("double")) return true;
    if (type.includes("single")) return false;

    const p1 = m.player1 || "";
    const p2 = m.player2 || "";
    return p1.includes("&") || p2.includes("&");
  }

  // players[0] = Saint Leo side, players[1] = Opponent side
  function getPlayerLabels(match) {
    const doubles = isDoublesMatch(match);

    if (doubles) {
      const teamNames =
        [match.player1, match.player2].filter(Boolean).join(" & ") ||
        "Saint Leo";

      const oppNames =
        [match.opponent1, match.opponent2].filter(Boolean).join(" & ") ||
        "Opponent";

      return [teamNames, oppNames];
    }

    const teamName = match.player1 || "Player 1";
    const oppName = match.opponent1 || match.player2 || "Player 2";
    return [teamName, oppName];
  }

  // normalize sets into [{team, opp}, ...]
  function normalizeSets(sets) {
    if (!Array.isArray(sets)) return [];
    return sets
      .map((s) => {
        if (Array.isArray(s)) {
          return { team: Number(s[0] ?? 0), opp: Number(s[1] ?? 0) };
        }
        if (s && typeof s === "object") {
          return {
            team: Number(s.team ?? s.home ?? s.a ?? 0),
            opp: Number(s.opp ?? s.away ?? s.b ?? 0),
          };
        }
        if (typeof s === "string" && s.includes("-")) {
          const [a, b] = s.split("-");
          return { team: Number(a ?? 0), opp: Number(b ?? 0) };
        }
        return { team: 0, opp: 0 };
      })
      .slice(0, 3);
  }

  // Decide which SIDE won this line: "team" (Saint Leo) or "opp" (opponent)
  // IMPORTANT: DB winner is "1" = team, "2" = opponent
  function getTeamWinner(match) {
    const status = String(match?.status ?? "").toLowerCase().trim();

    // only completed lines should count as winners
    // (prevents "all zeros" lines from being treated as ties)
    if (status !== "completed") return null;

    const sets = normalizeSets(match.sets);

    let teamSets = 0;
    let oppSets = 0;

    for (const set of sets) {
      const teamGames = Number(set.team ?? 0);
      const oppGames = Number(set.opp ?? 0);

      if (teamGames > oppGames) teamSets += 1;
      else if (oppGames > teamGames) oppSets += 1;
    }

    // If no real sets were played, fall back to match.winner
    // Accept both formats: "team"/"opponent" and "1"/"2"
    if (teamSets === 0 && oppSets === 0) {
      const w = String(match.winner ?? "").trim().toLowerCase();
      if (!w) return null;

      if (w === "team" || w === "1") return "team";
      if (w === "opponent" || w === "opp" || w === "2") return "opp";

      return null;
    }

    if (teamSets > oppSets) return "team";
    if (oppSets > teamSets) return "opp";

    // tie/unknown
    // if it ever happens, fallback to winner field
    const w = String(match.winner ?? "").trim().toLowerCase();
    if (w === "team" || w === "1") return "team";
    if (w === "opponent" || w === "opp" || w === "2") return "opp";

    return null;
  }

  // ---------- data loading ----------

  useEffect(() => {
    async function loadData() {
      try {
        const [eventsRes, matchRes] = await Promise.all([
          fetch(`${API_BASE_URL}/events/match/${id}`),
          fetch(`${API_BASE_URL}/schedule/${id}`),
        ]);

        const eventsJson = await eventsRes.json();
        const matchJson = await matchRes.json();

        setMatches(Array.isArray(eventsJson) ? eventsJson : []);
        setScheduleMatch(matchJson || null);
      } catch (err) {
        console.error("Error loading box score data:", err);
      }
    }

    loadData();
  }, [id]);

  const hasLive = useMemo(() => {
    return (matches || []).some(
      (m) => String(m?.status ?? "").toLowerCase().trim() === "live"
    );
  }, [matches]);

  const doublesMatches = useMemo(
    () => matches.filter((m) => isDoublesMatch(m)),
    [matches]
  );
  const singlesMatches = useMemo(
    () => matches.filter((m) => !isDoublesMatch(m)),
    [matches]
  );

  // team scoreboard (keep your current scoring logic, but we will DISPLAY full numbers only)
  const { saintLeoPoints, opponentPoints } = useMemo(() => {
    let sl = 0;
    let opp = 0;

    for (const m of matches) {
      const winnerSide = getTeamWinner(m);
      if (!winnerSide) continue;

      const value = isDoublesMatch(m) ? 0.5 : 1;

      if (winnerSide === "team") sl += value;
      if (winnerSide === "opp") opp += value;
    }

    return { saintLeoPoints: sl, opponentPoints: opp };
  }, [matches]);

  // display only full numbers (no 1.5)
  const saintLeoDisplay = Math.floor(saintLeoPoints);
  const opponentDisplay = Math.floor(opponentPoints);

  // ---------- UI: card for each line ----------

  const renderMatchCard = (match, index, labelPrefix) => {
    const sets = normalizeSets(match.sets);
    const players = getPlayerLabels(match);
    const title = `${labelPrefix} #${index + 1}`;

    const winnerSide = getTeamWinner(match); // "team" | "opp" | null
    const winnerLabel =
      winnerSide === "team" ? players[0] : winnerSide === "opp" ? players[1] : "";

    return (
      <div
        key={match.id || title}
        style={{
          background: "#ffffff",
          borderRadius: 16,
          padding: "12px 14px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
          minWidth: 260,
          flex: "1 1 260px",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 600 }}>{title}</div>
          <div
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#e6f2ea",
              color: "#174d2a",
            }}
          >
            FINAL
          </div>
        </div>

        {/* table of sets */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingBottom: 4 }}></th>
              {sets.map((_, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    paddingBottom: 4,
                  }}
                >
                  Set {i + 1}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {players.map((player, rowIdx) => {
              const isWinner =
                (winnerSide === "team" && rowIdx === 0) ||
                (winnerSide === "opp" && rowIdx === 1);

              return (
                <tr key={rowIdx}>
                  <td
                    style={{
                      fontWeight: 500,
                      padding: "4px 0",
                      verticalAlign: "middle",
                    }}
                  >
                    {player}
                    {isWinner && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          color: "#22c55e",
                        }}
                      >
                        ●
                      </span>
                    )}
                  </td>

                  {sets.map((set, setIdx) => (
                    <td
                      key={setIdx}
                      style={{
                        textAlign: "center",
                        padding: "4px 0",
                        fontSize: 14,
                      }}
                    >
                      {rowIdx === 0 ? set.team : set.opp}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* winner text */}
        {winnerLabel && (
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Winner: <span style={{ fontWeight: 700 }}>{winnerLabel}</span>
          </div>
        )}
      </div>
    );
  };

  // ---------- main render ----------

  const displayName =
    user?.first_name ||
    user?.name ||
    user?.email ||
    "Guest";

  return (
    <>
      <TopNav name={displayName} hasLive={hasLive} onLogout={logout} />

      <div
        style={{
          minHeight: "100vh",
          background: "#f5fbf7",
          padding: "80px 16px 40px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* header row: back button + centered title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <BackButton />
            <h1
              style={{
                flex: 1,
                textAlign: "center",
                margin: 0,
                color: "#174d2a",
              }}
            >
              Match Results
            </h1>
            <div style={{ width: 80 }} />
          </div>

          {scheduleMatch && (
            <>
              <h2
                style={{
                  textAlign: "center",
                  margin: 0,
                  color: "#174d2a",
                  fontSize: 22,
                }}
              >
                Saint Leo vs {scheduleMatch.opponent}
              </h2>
              <p
                style={{
                  textAlign: "center",
                  marginTop: 4,
                  marginBottom: 20,
                  color: "#4f6475",
                }}
              >
                {scheduleMatch.location || ""}
              </p>
            </>
          )}

          {/* team scoreboard */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "12px 24px",
                minWidth: 180,
                textAlign: "center",
                boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontWeight: 600, color: "#174d2a", marginBottom: 4 }}>
                Saint Leo
              </div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>
                {saintLeoDisplay}
              </div>
            </div>

            <div
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "12px 24px",
                minWidth: 180,
                textAlign: "center",
                boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontWeight: 600, color: "#174d2a", marginBottom: 4 }}>
                {scheduleMatch?.opponent || "Opponent"}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>
                {opponentDisplay}
              </div>
            </div>
          </div>

          {/* doubles */}
          {doublesMatches.length > 0 && (
            <>
              <h3
                style={{
                  marginBottom: 10,
                  marginTop: 10,
                  color: "#4f6475",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: 13,
                }}
              >
                Doubles
              </h3>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {doublesMatches.map((m, idx) => renderMatchCard(m, idx, "Doubles"))}
              </div>
            </>
          )}

          {/* singles */}
          {singlesMatches.length > 0 && (
            <>
              <h3
                style={{
                  marginBottom: 10,
                  marginTop: 10,
                  color: "#4f6475",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: 13,
                }}
              >
                Singles
              </h3>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                {singlesMatches.map((m, idx) => renderMatchCard(m, idx, "Singles"))}
              </div>
            </>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}
