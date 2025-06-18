import React, { useEffect, useState } from "react";

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
      style={{
        width: "40px",
        textAlign: "center",
        border: "1px solid #ccc",
        borderRadius: 4,
      }}
    />
  );
}

function LiveScore() {
  const [nextMatch, setNextMatch] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [scores, setScores] = useState([]);
  const [editableMatches, setEditableMatches] = useState([]);

  const isEditable = (idx) => editableMatches.includes(idx);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/schedule")
      .then((res) => res.json())
      .then((data) => {
        const upcoming = data
          .map((match) => ({
            ...match,
            date: new Date(match.date),
          }))
          .filter((match) => match.date > new Date())
          .sort((a, b) => a.date - b.date);

        setNextMatch(upcoming[0]);
      })
      .catch((err) => {
        console.error("Failed to load schedule:", err);
      });
  }, []);

  const fetchScore = () => {
    const sampleMatches = [
      // Doubles
      {
        matchType: "Doubles",
        matchNumber: 1,
        player1: "Eduardo / Tom",
        player2: "Ben / Max",
        sets: [[6, 7], [5, 7]],
        currentGame: [15, 40],
      },
      {
        matchType: "Doubles",
        matchNumber: 2,
        player1: "Leo / Jay",
        player2: "Sam / John",
        sets: [[3, 6], [4, 6]],
        currentGame: [0, 30],
      },
      {
        matchType: "Doubles",
        matchNumber: 3,
        player1: "Nico / Alex",
        player2: "Ivan / Mark",
        sets: [[6, 4], [3, 6], [2, 3]],
        currentGame: [40, 15],
      },
      // Singles
      {
        matchType: "Singles",
        matchNumber: 1,
        player1: "Eduardo",
        player2: "John",
        sets: [[6, 3], [4, 6], [2, 2]],
        currentGame: [30, 15],
      },
      {
        matchType: "Singles",
        matchNumber: 2,
        player1: "Alex",
        player2: "Ben",
        sets: [[7, 5], [2, 6], [1, 0]],
        currentGame: [40, 30],
      },
      {
        matchType: "Singles",
        matchNumber: 3,
        player1: "Leo",
        player2: "Mark",
        sets: [[6, 4], [6, 3]],
        currentGame: [15, 15],
      },
      {
        matchType: "Singles",
        matchNumber: 4,
        player1: "Tom",
        player2: "Max",
        sets: [[3, 6], [4, 4]],
        currentGame: [15, 40],
      },
      {
        matchType: "Singles",
        matchNumber: 5,
        player1: "Sam",
        player2: "Ivan",
        sets: [[6, 1], [6, 0]],
        currentGame: [0, 15],
      },
      {
        matchType: "Singles",
        matchNumber: 6,
        player1: "Nico",
        player2: "Jay",
        sets: [[5, 7], [7, 5], [1, 1]],
        currentGame: [30, 30],
      },
    ];

    setScores(sampleMatches);
  };

  const handleShowScore = () => {
    setShowScore(true);
    fetchScore();
  };

  const handleSave = (idx) => {
    setEditableMatches((prev) => prev.filter((i) => i !== idx));
  
    fetch("http://127.0.0.1:8000/livescore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(scores),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Scores saved:", data);
      })
      .catch((err) => {
        console.error("Failed to save scores:", err);
      });
  };
  
  return (
    <div style={{ padding: 20 }}>
      <h2>Live Score</h2>

      {!nextMatch ? (
        <p>No upcoming matches.</p>
      ) : (
        <div>
          <p>
            <strong>Next Match:</strong>
          </p>
          <p>
            {nextMatch.date.toLocaleString()} — {nextMatch.opponent} ({nextMatch.location})
          </p>
          {!showScore && <button onClick={handleShowScore}>Score</button>}
        </div>
      )}

      {showScore && (
        <div>
          {scores.map((score, idx) => {
            const sets = score.sets || [];
            const currentGame = score.currentGame || [null, null];
            const players = [score.player1 || "Player 1", score.player2 || "Player 2"];

            return (
              <div
                key={idx}
                style={{
                  marginTop: 20,
                  background: "#e0f7fa",
                  padding: 20,
                  borderRadius: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <h3>
                    {score.matchType} #{score.matchNumber}
                  </h3>
                  <div>
                    {isEditable(idx) ? (
                      <button
                        onClick={() => handleSave(idx)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditableMatches((prev) => [...prev, idx])}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#0288d1",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Edit Score
                      </button>
                    )}
                  </div>
                </div>

                <table style={{ width: "100%", textAlign: "center", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th></th>
                      {sets.map((_, index) => (
                        <th key={index}>Set {index + 1}</th>
                      ))}
                      <th>Game</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #ccc" }}>
                        <td style={{ fontWeight: "bold", padding: 8 }}>{player}</td>
                        {sets.map((set, j) => (
                          <td key={j}>
                            {isEditable(idx) ? (
                              <ScoreInput
                                value={sets[j][i]}
                                onChange={(val) => {
                                  const updatedScores = [...scores];
                                  updatedScores[idx].sets[j][i] = val;
                                  setScores(updatedScores);
                                }}
                                onEnter={() => handleSave(idx)}
                              />
                            ) : (
                              sets[j][i] ?? "–"
                            )}
                          </td>
                        ))}
                        <td
                          style={{
                            background: i === 0 ? "#e3f2fd" : "#bbdefb",
                            fontWeight: "bold",
                            borderRadius: 4,
                          }}
                        >
                          {isEditable(idx) ? (
                            <ScoreInput
                              value={currentGame[i]}
                              onChange={(val) => {
                                const updatedScores = [...scores];
                                updatedScores[idx].currentGame[i] = val;
                                setScores(updatedScores);
                              }}
                              onEnter={() => handleSave(idx)}
                            />
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
      )}
    </div>
  );
}

export default LiveScore;
