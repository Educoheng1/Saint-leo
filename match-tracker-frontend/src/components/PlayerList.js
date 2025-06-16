import { useState, useEffect } from "react";

function PlayerList({ onClose }) {
  const [name, setName] = useState("");
  const [players, setPlayers] = useState([]);
  

  // Fetch all players
  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line
  }, []);

  const fetchPlayers = () => {
    fetch("http://127.0.0.1:8000/players")
      .then((res) => res.json())
      .then(setPlayers);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("http://127.0.0.1:8000/players", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      setName("");
      fetchPlayers(); // Refresh player list
    } else {
      alert("Failed to add player");
    }
  };

  return (
    <div style={{ background: "#e0f7fa", padding: 20, borderRadius: 8, minWidth: 300, position: "relative" }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          background: "transparent",
          border: "none",
          fontSize: 20,
          cursor: "pointer",
        }}
        title="Close"
      >
        ×
      </button>
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <h3>Add New Player</h3>
        <input
          type="text"
          placeholder="Player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ marginRight: 8 }}
        />
        <button type="submit">Add Player</button>
      </form>
      <h3>Player List</h3>
      <ul>
        {players.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default PlayerList;
