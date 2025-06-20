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

function LiveScore() {
  const [nextMatch, setNextMatch] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [scores, setScores] = useState([]);
  const [editableMatches, setEditableMatches] = useState([]);
  const [showFinishMatchForm, setShowFinishMatchForm] = useState(false);
const [finishedMatchData, setFinishedMatchData] = useState({
  teamScore: ["", ""],
  boxScore: [],
});

  const isAdmin = true; // set to false to simulate a non-admin user

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
        status: "live"
      },
      {
        matchType: "Doubles",
        matchNumber: 2,
        player1: "Leo / Jay",
        player2: "Sam / John",
        sets: [[3, 6], [4, 6]],
        currentGame: [0, 30],
        status: "live"
      },
      {
        matchType: "Doubles",
        matchNumber: 3,
        player1: "Nico / Alex",
        player2: "Ivan / Mark",
        sets: [[6, 4], [3, 6], [2, 3]],
        currentGame: [40, 15],
        status: "live"
      },
      // Singles
      {
        matchType: "Singles",
        matchNumber: 1,
        player1: "Eduardo",
        player2: "John",
        sets: [[6, 3], [4, 6], [2, 2]],
        currentGame: [30, 15],
        status: "live"
      },
      {
        matchType: "Singles",
        matchNumber: 2,
        player1: "Alex",
        player2: "Ben",
        sets: [[7, 5], [2, 6], [1, 0]],
        currentGame: [40, 30],
        status: "completed"
      },
      {
        matchType: "Singles",
        matchNumber: 3,
        player1: "Leo",
        player2: "Mark",
        sets: [[6, 4], [6, 3]],
        currentGame: [15, 15],
        status: "live"
      },
      {
        matchType: "Singles",
        matchNumber: 4,
        player1: "Tom",
        player2: "Max",
        sets: [[3, 6], [4, 4]],
        currentGame: [15, 40],
        status: "live"
      },
      {
        matchType: "Singles",
        matchNumber: 5,
        player1: "Sam",
        player2: "Ivan",
        sets: [[6, 1], [6, 0]],
        currentGame: [0, 15],
        status: "live"
      },
      {
        matchType: "Singles",
        matchNumber: 6,
        player1: "Nico",
        player2: "Jay",
        sets: [[5, 7], [7, 5], [1, 1]],
        currentGame: [30, 30],
        status: "live"
      },
    ];

    setScores(sampleMatches);
  };

  const handleShowScore = () => {
    setShowScore(true);
    fetchScore();
  };
  const handleSubmitFinishMatch = async () => {
    const response = await fetch("http://127.0.0.1:8000/finishmatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finishedMatchData),
    });
  
    if (response.ok) {
      alert("Match marked as completed!");
      setShowFinishMatchForm(false);
      setShowScore(false);
      setFinishedMatchData({ teamScore: ["", ""], boxScore: [] });
    } else {
      alert("Failed to finish match");
    }
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
            {!showScore && (
              <button className="nav-button" onClick={handleShowScore}>
                Show Live Score
              </button>
            )}
          </>
        )}
      </div>
      {showScore && (
  <div style={{ textAlign: "center", marginTop: 30 }}>
    <button className="nav-button" onClick={() => setShowFinishMatchForm(true)}>
      Finish Match
    </button>
  </div>
)}
{showFinishMatchForm && (
  <div className="lineup-editor">
    <h3 className="lineup-title">Finish Match</h3>

    <label>Team Score</label>
    <input
      placeholder="Team 1"
      value={finishedMatchData.teamScore[0]}
      onChange={(e) =>
        setFinishedMatchData((prev) => ({
          ...prev,
          teamScore: [e.target.value, prev.teamScore[1]],
        }))
      }
    />
    <input
      placeholder="Team 2"
      value={finishedMatchData.teamScore[1]}
      onChange={(e) =>
        setFinishedMatchData((prev) => ({
          ...prev,
          teamScore: [prev.teamScore[0], e.target.value],
        }))
      }
    />

    <button
      className="save-button"
      style={{ marginTop: 10 }}
      onClick={handleSubmitFinishMatch}
    >
      Submit Match Result
    </button>
  </div>
)}

      {showScore && (
         <div className="match-list">
          {scores.map((score, idx) => {
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
                    ) : isAdmin ? (
                      <button
                        onClick={() => setEditableMatches((prev) => [...prev, idx])}
                        className="edit-button"
                      >
                        Edit Score
                      </button>
                    ) : null}
                  </div>
                </div>
  
                <table className="match-table">
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
                      <tr key={i}>
                   <td style={{ fontWeight: "bold", padding: 8 }}>
  {player}{" "}
  {(() => {
    const totalGames = (sets ?? []).reduce((sum, set) => {
      const [p1, p2] = set.map((v) => (isNaN(v) ? 0 : v));
      return sum + p1 + p2;
    }, 0);
    const serverIndex = totalGames % 2 === 0 ? 0 : 1;
    return i === serverIndex ? "🎾" : "";
  })()}
</td>

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