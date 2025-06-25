
import React, { useEffect, useState } from "react";
import "../styles.css";

export function ScoreInput({ value, onChange, onEnter }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      value={
        focused
          ? value === null || isNaN(value) ? "" : value
          : value === null || isNaN(value) ? "–" : value
      }
      className="score-input"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const val = e.target.value;
        onChange(/^\d+$/.test(val) ? parseInt(val) : null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          onEnter();
        }
      }}
    />
  );
}

function PlayerAssignment({ matchIndex, onSave, onClose }) {
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");

  return (
    <div className="lineup-editor">
      <h3 className="lineup-title">Assign Players</h3>
      <input placeholder="Team A" value={player1} onChange={(e) => setPlayer1(e.target.value)} />
      <input placeholder="Team B" value={player2} onChange={(e) => setPlayer2(e.target.value)} />
      <button
        className="save-button"
        onClick={() => {
          console.log("Saving from PlayerAssignment", matchIndex, player1, player2);
          onSave(matchIndex, player1, player2);
        }}
      >
        Save
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}

function LiveScore() {
  const [nextMatch, setNextMatch] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [scores, setScores] = useState([]);
  const [editableMatches, setEditableMatches] = useState([]);
  const [showAssignIndex, setShowAssignIndex] = useState(null);
  const [teamScore, setTeamScore] = useState([0, 0]); // [Team A, Team B]

  const isAdmin = true;

  const isEditable = (idx) => editableMatches.includes(idx);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/schedule")
      .then((res) => res.json())
      .then((data) => {
        const upcoming = data
          .map((match) => ({ ...match, date: new Date(match.date) }))
          .filter((match) => match.date > new Date())
          .sort((a, b) => a.date - b.date);
        setNextMatch(upcoming[0]);
      })
      .catch((err) => console.error("Failed to load schedule:", err));
  }, []);

  const fetchScore = () => {
    const matchTemplate = [
      { matchType: "Doubles", matchNumber: 1 },
      { matchType: "Doubles", matchNumber: 2 },
      { matchType: "Doubles", matchNumber: 3 },
      { matchType: "Singles", matchNumber: 1 },
      { matchType: "Singles", matchNumber: 2 },
      { matchType: "Singles", matchNumber: 3 },
      { matchType: "Singles", matchNumber: 4 },
      { matchType: "Singles", matchNumber: 5 },
      { matchType: "Singles", matchNumber: 6 },
    ];

    const emptyMatches = matchTemplate.map((m) => ({
      ...m,
      player1: null,
      player2: null,
      sets: [],
      currentGame: [],
      status: "pending",
      started: false,
    }));

    setScores(emptyMatches);
  };

  const handleShowScore = () => {
    setShowScore(true);
    fetchScore();
  };

  const handleSave = (idx) => {
    setEditableMatches((prev) => prev.filter((i) => i !== idx));
    const updatedMatch = scores[idx];
    fetch(`http://127.0.0.1:8000/livescore/${updatedMatch.matchNumber}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedMatch),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save");
        return res.json();
      })
      .then((data) => console.log("Saved match:", data))
      .catch((err) => console.error("Failed to save match:", err));
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 className="page-title">Live Score</h2>
      <div className="next-match-container">
        {!nextMatch ? (
          <p className="no-match">No upcoming matches.</p>
        ) : (
          <>
            <h3 className="match-heading">Playing Now</h3>
            <p className="match-info">
              {nextMatch.date.toLocaleString()} — {nextMatch.opponent} ({nextMatch.location})
            </p>
            <h2 className="page-title">Live Score</h2>
<h3 style={{ marginBottom: 20 }}>
  Current Score: {teamScore[0]} - {teamScore[1]}
</h3>

            {!showScore && (
              <button className="nav-button" onClick={handleShowScore}>
                Show Live Score
              </button>
            )}
          </>
        )}
      </div>

      {showScore && (
        <>
          <div className="match-list">
            {scores.map((score, idx) => {
              if (!score.started) {
                return (
                  <div key={idx} className="match-status-box not-started">
                    <h3>{score.matchType} #{score.matchNumber}</h3>
                    <button className="nav-button" onClick={() => setShowAssignIndex(idx)}>
                      Assign Players & Start
                    </button>
                  </div>
                );
              }

              const sets = score.sets || [];
              const currentGame = score.currentGame || [null, null];
              const players = [score.player1 || "Player 1", score.player2 || "Player 2"];

              return (
                <div
                  key={idx}
                  className={`match-status-box ${score.status === "live" ? "live" : "completed"}`}
                >
                  <div className="match-header">
                    <h3 className="match-title">{score.matchType} #{score.matchNumber}</h3>
                    <div>
  {isEditable(idx) ? (
    <button onClick={() => handleSave(idx)} className="save-button">
      Save
    </button>
  ) : isAdmin && (
    <>
      <button
        onClick={() => setEditableMatches((prev) => [...prev, idx])}
        className="edit-button"
      >
        Edit Score
      </button>
      {score.status === "live" && (
        <button
          className="end-button"
          onClick={() => {
            const winner = window.prompt("Who won? (A or B)")?.toUpperCase();
            if (winner === "A") {
              setTeamScore(([a, b]) => [a + 1, b]);
            } else if (winner === "B") {
              setTeamScore(([a, b]) => [a, b + 1]);
            } else {
              alert("Invalid input. Type A or B.");
              return;
            }

            const updated = [...scores];
            updated[idx].status = "completed";
            setScores(updated);
          }}
        >
          End Match
        </button>
      )}
    </>
  )}
</div>

                  </div>

                  <table className="match-table">
                    <thead>
                      <tr>
                        <th></th>
                        {sets.map((_, index) => <th key={index}>Set {index + 1}</th>)}
                        <th>Game</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: "bold", padding: 8 }}>
                            {player}
                            {" "}
                            {(() => {
                              const totalGames = sets.reduce((sum, set) => sum + set.reduce((a, b) => a + b, 0), 0);
                              const serverIndex = totalGames % 2 === 0 ? 0 : 1;
                              return i === serverIndex ? "🎾" : "";
                            })()}
                          </td>
                          {sets.map((set, j) => (
                            <td key={j}>
                              {isEditable(idx) ? (
                                <ScoreInput value={set[i]} onChange={(val) => {
                                  const updatedScores = [...scores];
                                  updatedScores[idx].sets[j][i] = val;
                                  setScores(updatedScores);
                                }} onEnter={() => handleSave(idx)} />
                              ) : (
                                set[i] ?? "–"
                              )}
                            </td>
                          ))}
                          <td>
                            {isEditable(idx) ? (
                              <ScoreInput value={currentGame[i]} onChange={(val) => {
                                const updatedScores = [...scores];
                                updatedScores[idx].currentGame[i] = val;
                                setScores(updatedScores);
                              }} onEnter={() => handleSave(idx)} />
                            ) : (
                              currentGame[i] ?? "–"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {showAssignIndex !== null && (
            <div style={{
              position: "fixed",
              top: 100,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              background: "#fff",
              padding: 20,
              border: "2px solid black"
            }}>
              <PlayerAssignment
                matchIndex={showAssignIndex}
                onSave={(idx, p1, p2) => {
                  const updated = [...scores];
                  if (!updated[idx]) {
                    console.error("Invalid idx:", idx, "scores:", updated);
                    return;
                  }
                  updated[idx].player1 = p1;
                  updated[idx].player2 = p2;
                  updated[idx].started = true;
                  updated[idx].status = "live";  
                  updated[idx].sets =
                updated[idx].matchType === "Singles"
                       ? [[0, 0], [0, 0], [0, 0]]
                         : [[0, 0]];
                  updated[idx].currentGame = [0, 0];
                  setScores(updated);
                  setShowAssignIndex(null);
                }}
                onClose={() => setShowAssignIndex(null)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LiveScore;