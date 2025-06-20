import { useEffect, useState } from "react";

export default function LineupEditor({ matchId, onClose }) {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    // Fetch all players
    fetch("http://127.0.0.1:8000/players")
      .then((res) => res.json())
      .then(setPlayers);

    // Fetch existing lineup
    fetch(`http://127.0.0.1:8000/schedule/${matchId}/lineup`)
    .then((res) => res.json())
      .then((data) => {
        setSelected(data.players || []);
      });
  }, [matchId]);

  const togglePlayer = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    await fetch(`http://127.0.0.1:8000/schedule/${matchId}/lineup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: selected }),
    });
    onClose();
  };

  return (
    <div className="lineup-editor">
      <h3 className="lineup-title">Assign Players</h3>
      <div className="player-list">
        {players.map((player) => (
          <label key={player.id} className="player-item">
            <input
              type="checkbox"
              checked={selected.includes(player.id)}
              onChange={() => togglePlayer(player.id)}
            />
            {player.name}
          </label>
        ))}
      </div>
      <div className="lineup-buttons">
        <button className="save-button" onClick={handleSave}>Save</button>
        <button className="cancel-button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}  
