import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import Footer from "./Footer";

import API_BASE_URL from "../config";

export default function BoxScorePage() {
  const { id } = useParams();
  const [matches, setMatches] = useState([]);
  const [scheduleMatch, setScheduleMatch] = useState(null);

  // ---------- helpers ----------

  // is this line a doubles line?
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

  // Build the two player labels (handles doubles with 4 separate player fields)
  function getPlayerLabels(match) {
    const doubles = isDoublesMatch(match);
  
    if (doubles) {
      // Saint Leo team side
      const teamNames =
        [match.player1, match.player2].filter(Boolean).join(" & ") || "Saint Leo";
  
      // Opponent side
      const oppNames =
        [match.opponent1, match.opponent2].filter(Boolean).join(" & ") ||
        "Opponent";
  
      // players[0] = Saint Leo, players[1] = Opponent
      return [teamNames, oppNames];
    }
  
    // Singles / default:
    // player1 = Saint Leo, opponent1 (or player2) = Opponent
    const teamName = match.player1 || "Player 1";
    const oppName = match.opponent1 || match.player2 || "Player 2";
  
    return [teamName, oppName];
  }
  

  // Figure out who the TEAM winner is for scoreboard
// Decide which SIDE won this line: "team" (Saint Leo) or "opp" (opponent)
function getTeamWinner(match) {
  const sets = match.sets || [];

  let teamSets = 0;
  let oppSets = 0;

  for (const set of sets) {
    const teamGames = set.team ?? 0;
    const oppGames = set.opp ?? 0;

    if (teamGames > oppGames) teamSets += 1;
    else if (oppGames > teamGames) oppSets += 1;
  }

  // If no real sets were played, fall back to the winner field (optional)
  if (teamSets === 0 && oppSets === 0) {
    const w = String(match.winner || "").trim().toLowerCase();
    if (!w) return null;

    if (["team"].includes(w)) return "team";          // if you ever save "team"
    if (["opp", "opponent"].includes(w)) return "opp";
    if (["1", "p1", "player1"].includes(w)) return "opp";   // from your JSON, "1" behaved like opponent
    if (["2", "p2", "player2"].includes(w)) return "team";
    return null;
  }

  if (teamSets > oppSets) return "team";
  if (oppSets > teamSets) return "opp";
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

  // split into doubles / singles for layout
  const doublesMatches = useMemo(
    () => matches.filter((m) => isDoublesMatch(m)),
    [matches]
  );
  const singlesMatches = useMemo(
    () => matches.filter((m) => !isDoublesMatch(m)),
    [matches]
  );

  // TEAM score from all finished lines
  const { saintLeoPoints, opponentPoints } = useMemo(() => {
    let sl = 0;
    let opp = 0;
  
    for (const m of matches) {
      const winnerSide = getTeamWinner(m);
      if (!winnerSide) continue; // skip unfinished / unknown
  
      const value = isDoublesMatch(m) ? 0.5 : 1;
  
      if (winnerSide === "team") sl += value; // Saint Leo
      if (winnerSide === "opp") opp += value; // opponent
    }
  
    return { saintLeoPoints: sl, opponentPoints: opp };
  }, [matches]);
  
  // ---------- UI: card for each line ----------

  const renderMatchCard = (match, index, labelPrefix) => {
    const sets = Array.isArray(match.sets) ? match.sets : [];
    const players = getPlayerLabels(match);
    const title = `${labelPrefix} #${index + 1}`;

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
              const winnerSide = getTeamWinner(match);
              const isWinner =
                (winnerSide === "home" && rowIdx === 0) ||
                (winnerSide === "away" && rowIdx === 1);

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
                  {sets.map((set, setIdx) => {
                    let scoreText = "";

                    if (Array.isArray(set)) {
                      // e.g. [6,3] or ["6","3"]
                      scoreText = set[rowIdx];
                    } else if (set && typeof set === "object") {
                      const values = Object.values(set);
                      scoreText =
                        values[rowIdx] !== undefined ? values[rowIdx] : "";
                    } else if (
                      typeof set === "string" &&
                      set.includes("-")
                    ) {
                      const [a, b] = set.split("-");
                      scoreText = rowIdx === 0 ? a.trim() : b.trim();
                    } else if (set != null) {
                      scoreText = String(set);
                    }

                    return (
                      <td
                        key={setIdx}
                        style={{
                          textAlign: "center",
                          padding: "4px 0",
                          fontSize: 14,
                        }}
                      >
                        {scoreText}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* winner text */}
        {match.winner && (
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
            }}
          >
            Winner:{" "}
            <strong>
              {getTeamWinner(match) === "home" ? players[0] : players[1]}
            </strong>
          </div>
        )}
      </div>
    );
  };

  // ---------- main render ----------

  return (
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
  
          {/* spacer to keep title centered */}
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
            <div
              style={{ fontWeight: 600, color: "#174d2a", marginBottom: 4 }}
            >
              Saint Leo
            </div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>
              {saintLeoPoints}
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
            <div
              style={{ fontWeight: 600, color: "#174d2a", marginBottom: 4 }}
            >
              {scheduleMatch?.opponent || "Opponent"}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>
              {opponentPoints}
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
              {doublesMatches.map((m, idx) =>
                renderMatchCard(m, idx, "Doubles")
              )}
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
              {singlesMatches.map((m, idx) =>
                renderMatchCard(m, idx, "Singles")
              )}
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

