import React, { useState, useEffect } from "react";
import { ScoreInput } from "./components/LiveScore";
import { useAdmin } from "./AdminContext"; // 👈 import isAdmin
import API_BASE_URL from "./config"; // adjust path if needed


export default function Admin() {
  const { isAdmin } = useAdmin();
  const [matches, setMatches] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: "", country: "" });

  useEffect(() => {
    fetch(`${API_BASE_URL}/matches`)
      .then((res) => res.json())
      .then(setMatches);
  }, []);

  const updateScore = (matchId, newScore) => {
    fetch(`${API_BASE_URL}/matches/${matchId}/score`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newScore),
    });
  };

  const handleAddPlayer = () => {
    fetch(`${API_BASE_URL}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlayer),
    }).then(() => {
      setNewPlayer({ name: "", country: "" });
    });
  };

  // 👇 block guest users
  if (!isAdmin) {
    return <div style={{ padding: 20 }}>Access denied. Admins only.</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Panel</h1>

      <h2>Update Match Scores</h2>
      {matches.map((match) => (
        <div key={match.id} style={{ marginBottom: 10 }}>
          <div>{match.date} - vs {match.opponent}</div>
          <ScoreInput
            value={match.score_team1}
            onChange={(val) => {
              setMatches((prev) =>
                prev.map((m) =>
                  m.id === match.id ? { ...m, score_team1: val } : m
                )
              );
            }}
          />
          <ScoreInput
            value={match.score_team2}
            onChange={(val) => {
              setMatches((prev) =>
                prev.map((m) =>
                  m.id === match.id ? { ...m, score_team2: val } : m
                )
              );
            }}
          />
          <button
            onClick={() =>
              updateScore(match.id, {
                score_team1: match.score_team1,
                score_team2: match.score_team2,
              })
            }
          >
            Save Score
          </button>
        </div>
      ))}

      <hr />

      <h2>Add New Player</h2>
      <input
        placeholder="Name"
        value={newPlayer.name}
        onChange={(e) =>
          setNewPlayer((p) => ({ ...p, name: e.target.value }))
        }
      />
      <input
        placeholder="Country"
        value={newPlayer.country}
        onChange={(e) =>
          setNewPlayer((p) => ({ ...p, country: e.target.value }))
        }
      />
      <button onClick={handleAddPlayer}>Add Player</button>
    </div>
  );
}
