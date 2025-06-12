export default function LineupList({ lineup, players, matchId, onAddPlayer }) {
    if (!matchId) return null;
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      const playerId = e.target.player.value;
      await fetch(`http://127.0.0.1:8000/matches/${matchId}/lineup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId }),
      });
      onAddPlayer();
    };
  
    return (
      <>
        <form onSubmit={handleSubmit}>
          <h3>Add to Lineup</h3>
          <select name="player">
            {Object.entries(players).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <button type="submit">Add</button>
        </form>
        <ul>
          {lineup.map((l) => (
            <li key={l.id}>{players[l.player_id] || "Unknown Player"}</li>
          ))}
        </ul>
      </>
    );
  }
  