
import React, { useEffect, useState } from "react";
import "../styles.css";
import { useAdmin } from "../AdminContext"; 
import BackButton from "./BackButton";

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

function PlayerAssignment({ matchIndex, matchType, onSave, onClose, playerList = [] }) {
    const isDoubles = matchType === "Doubles";
  
    const [teamAPlayers, setTeamAPlayers] = useState(["", ""]);
    const [teamBPlayers, setTeamBPlayers] = useState(["", ""]);
  
    const handleTeamAChange = (index, value) => {
      const updated = [...teamAPlayers];
      updated[index] = value;
      setTeamAPlayers(updated);
    };
  
    const handleTeamBChange = (index, value) => {
      const updated = [...teamBPlayers];
      updated[index] = value;
      setTeamBPlayers(updated);
    };
  
    return (
      <div className="lineup-editor">
        <h3 className="lineup-title">Assign Players</h3>
  
        <div style={{ marginBottom: "10px" }}>
          <strong>Team A:</strong>
          {[0, isDoubles ? 1 : null].map(
            (i) =>
              i !== null && (
                <select
                  key={i}
                  value={teamAPlayers[i]}
                  onChange={(e) => handleTeamAChange(i, e.target.value)}
                  className="match-form"
                >
                  <option value="">Select Player {i + 1}</option>
                  {playerList.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )
          )}
        </div>
  
        <div style={{ marginBottom: "10px" }}>
          <strong>Team B:</strong>
          {[0, isDoubles ? 1 : null].map(
            (i) =>
              i !== null && (
                <input
                  key={i}
                  placeholder={`Player ${i + 1}`}
                  value={teamBPlayers[i]}
                  onChange={(e) => handleTeamBChange(i, e.target.value)}
                />
              )
          )}
        </div>
        <button
  className="save-button"
  onClick={() => {
    const teamA = isDoubles ? teamAPlayers.join(" & ") : teamAPlayers[0];
    const teamB = isDoubles ? teamBPlayers.join(" & ") : teamBPlayers[0];

    // Ask who is serving
    const server = window.prompt("Who is serving first? Enter A or B", "A");

    const serveValue = server === "B" ? 1 : 0;

    onSave(matchIndex, teamA, teamB, serveValue); // pass serve info
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
  const [eventStarted, setEventStarted] = useState(false);
  const [eventFinished, setEventFinished] = useState(false);
  const [playerList, setPlayerList] = useState([]);



  const { isAdmin } = useAdmin();

  const isEditable = (idx) => editableMatches.includes(idx);

  useEffect(() => {
    fetch("http://localhost:8000/players")
      .then((res) => res.json())
      .then(setPlayerList)
      .catch((err) => console.error("Failed to fetch players", err));
  }, []);

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
         <BackButton />
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
            {isAdmin && !eventStarted && (
  <button className="event-button" onClick={() => setEventStarted(true)}>
    Start Event
  </button>
)}

{isAdmin && eventStarted && !eventFinished && (
  <button className="event-button" onClick={() => setEventFinished(true)}>
    Finish Event
  </button>
)}



<h2 className="page-title">Live Score</h2>

{eventStarted && !eventFinished ? (
  <>
    <h3 style={{ marginBottom: 20 }}>
      Current Score: {teamScore[0]} - {teamScore[1]}
    </h3>

    {!showScore && (
      <button className="nav-button" onClick={handleShowScore}>
        Show Live Score
      </button>
    )}
  </>
) : eventFinished ? (
  <p style={{ color: "gray" }}>The event has finished. Live scores are no longer available.</p>
) : (
  <p style={{ color: "red" }}>You must start the event to view live scores.</p>
)}


          </>
        )}
      </div>

      {showScore && (
  <>
    <div className="match-list">
      {scores.map((score, idx) => {
        if (!score.started) {
          // ✅ Admins see the match box and the assign button
          return isAdmin ? (
            <div key={idx} className="match-status-box not-started">
              <h3>{score.matchType} #{score.matchNumber}</h3>
              <button className="nav-button" onClick={() => setShowAssignIndex(idx)}>
                Assign Players & Start
              </button>
            </div>
          ) : null; // 👈 guests see nothing
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
                matchType={scores[showAssignIndex]?.matchType}
                onSave={(idx, p1, p2, serveValue) => {
                    const updated = [...scores];
                    if (!updated[idx]) return;
                  
                    updated[idx].player1 = p1;
                    updated[idx].player2 = p2;
                    updated[idx].started = true;
                    updated[idx].status = "live";
                    updated[idx].sets =
                      updated[idx].matchType === "Singles"
                        ? [[0, 0], [0, 0], [0, 0]]
                        : [[0, 0]];
                    updated[idx].currentGame = [0, 0];
                    updated[idx].currentServe = serveValue;
                  
                    setScores(updated);
                    setShowAssignIndex(null);
                  }}
                  
                onClose={() => setShowAssignIndex(null)}
                playerList={playerList}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LiveScore;