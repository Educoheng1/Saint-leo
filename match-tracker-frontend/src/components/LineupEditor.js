import { useEffect, useState } from "react";

export default function LineupEditor({ matchId, onClose }) {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    // Fetch all players
    fetch("http://127.0.0.1:8000/players")
      .then((res) => res.json())
      .then(setPlayers);

    // Fetch current lineup
    fetch(`http://127.0.0.1:8000/schedule/${matchId}/lineup`)
      .then((res) => res.json())
      .then(data => setSelected(data.players));
  }, [matchId]);

  const handleChange = (playerId) => {
    setSelected((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleSubmit = async () => {
    await fetch(`http://127.0.0.1:8000/schedule/${matchId}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: selected }),
    });
    onClose();
  };

  return (
    <div style={{ background: "#e0f7fa", padding: 20, borderRadius: 10, maxWidth: 400 }}>
      <h3>Assign Players to Match #{matchId}</h3>
      <ul>
        {players.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => handleChange(p.id)}
              />
              {p.name}
            </label>
          </li>
        ))}
      </ul>
      <button onClick={handleSubmit}>Save Lineup</button>
      <button onClick={onClose} style={{ marginLeft: 10 }}>Cancel</button>
    </div>
  );
}
