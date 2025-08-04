import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackButton from "../components/BackButton";
import "../styles.css";
import API_BASE_URL from "../config"; // adjust path if needed

export default function BoxScorePage() {
  const { id } = useParams();
  const [matches, setMatches] = useState([]);
  const [scheduleMatch, setScheduleMatch] = useState(null);


  useEffect(() => {
    fetch(`${API_BASE_URL}/players/events/match/${id}`)
      .then((res) => res.json())
      .then(setMatches)
      .catch((err) => console.error("Error loading box scores:", err));
  }, [id]);

  const getMatchNumber = (() => {
    let singlesCount = 0;
    let doublesCount = 0;
    return (match) => {
      const isDoubles = match.player1.includes("&") || match.player2.includes("&");
      if (isDoubles) return `Doubles #${++doublesCount}`;
      return `Singles #${++singlesCount}`;
    };
  })();

  useEffect(() => {
    async function loadMatchAndEvents() {
      try {
        const [eventsRes, matchRes] = await Promise.all([
          fetch(`${API_BASE_URL}/events/match/${id}`),
          fetch(`${API_BASE_URL}/schedule/${id}`)

        ]);
  
        const events = await eventsRes.json();
        const match = await matchRes.json();
  
        setMatches(events);
        setScheduleMatch(match);
      } catch (err) {
        console.error("Error loading box score or match info:", err);
      }
    }
  
    loadMatchAndEvents();
  }, [id]);
  
  return (
    <div style={{ padding: 20 }}>
      <BackButton />
      <h2 className="page-title">Box Scores</h2>
      {scheduleMatch && (
  <h3 className="match-heading" style={{ textAlign: "center", marginBottom: 20 }}>
    Saint Leo vs {scheduleMatch.opponent}
  </h3>
)}


      <div className="match-list">
        {matches.map((match, idx) => {
          const sets = match.sets || [];
          const matchLabel = getMatchNumber(match);
          const players = [match.player1 || "Player 1", match.player2 || "Player 2"];

          return (
            <div key={match.id} className="match-status-box completed">
              <div className="match-header">
                <h3 className="match-title">{matchLabel}</h3>
              </div>

              <table className="match-table">
                <thead>
                  <tr>
                    <th></th>
                    {sets.map((_, index) => <th key={index}>Set {index + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: "bold", padding: 8 }}>
  {player}
  {(() => {
    if (!match.winner) return null;
    const isWinner = (match.winner === "A" && i === 0) || (match.winner === "B" && i === 1);
    return isWinner ? " ✅" : "";
  })()}
</td>

                      {sets.map((set, j) => (
                        <td key={j}>{set[i]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {match.winner && (
                <div className="match-winner">
                  Winner: <strong>{match.winner === "A" ? match.player1 : match.player2}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
