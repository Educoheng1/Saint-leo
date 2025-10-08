import React, { useEffect, useState } from "react";
import { useAdmin } from "../AdminContext";
import BackButton from "./BackButton";
import API_BASE_URL from "../config"; // adjust path if needed


export default function PlayerList({ onClose }) {
  const { isAdmin } = useAdmin(); // 👈 Get admin status
  const [players, setPlayers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    year: "",
    singles_season: "",
    singles_all_time: "",
    doubles_season: "",
    doubles_all_time: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [editedPlayer, setEditedPlayer] = useState({});
  
  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = () => {
    const yearOrder = { Senior: 4, Junior: 3, Sophomore: 2, Freshman: 1 };
  
    fetch(`${API_BASE_URL}/players`)
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const aRank = yearOrder[a.year?.trim()] || 0;
          const bRank = yearOrder[b.year?.trim()] || 0;
          return bRank - aRank; // Senior first
        });
        setPlayers(sorted);
      })
      .catch((err) => console.error("Failed to fetch players:", err));
  };
  

  const handleChange = (e) => {
    setNewPlayer({ ...newPlayer, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE_URL}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlayer)
    });

    if (res.ok) {
      fetchPlayers();
      setShowForm(false);
      setNewPlayer({
        name: "",
        year: "",
        singles_season: "",
        singles_all_time: "",
        doubles_season: "",
        doubles_all_time: ""
      });
    } else {
      alert("Failed to add player.");
    }
  };

  async function startEvent(matchId, player1, player2) {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: matchId,
        player1: player1,
        player2: player2,
        sets: [[0, 0]],
        current_game: [0, 0],
        status: "live",
        started: true,
        current_serve: 0,
      }),
    });
    const data = await response.json();
    console.log("Event created:", data);
  }

  const handleDelete = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this player?");
    if (!confirm) return;

    const res = await fetch(`${API_BASE_URL}/players/${id}`, {
      method: "DELETE"
    });

    if (res.ok) {
      fetchPlayers();
    } else {
      alert("Failed to delete player.");
    }
  };


  return (
    <div className="card" style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
       <BackButton />
      <h2 className="home-title" style={{ textAlign: "center" }}>Player Roster</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#f2f2f2" }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Year</th>
            <th style={thStyle}>Singles (Season)</th>
            <th style={thStyle}>Singles (All-Time)</th>
            <th style={thStyle}>Doubles (Season)</th>
            <th style={thStyle}>Doubles (All-Time)</th>
            {isAdmin && <th style={thStyle}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <td style={tdStyle}>
  {editingId === p.id ? (
    <input
      value={editedPlayer.name}
      onChange={(e) => setEditedPlayer({ ...editedPlayer, name: e.target.value })}
    />
  ) : (
    p.name
  )}
</td>
<td style={tdStyle}>
  {editingId === p.id ? (
    <input
      value={editedPlayer.year}
      onChange={(e) => setEditedPlayer({ ...editedPlayer, year: e.target.value })}
    />
  ) : (
    p.year
  )}
</td>
<td style={tdStyle}>
  {editingId === p.id ? (
    <input
      value={editedPlayer.singles_season}
      onChange={(e) => setEditedPlayer({ ...editedPlayer, singles_season: e.target.value })}
    />
  ) : (
    p.singles_season
  )}
</td>
<td style={tdStyle}>
  {editingId === p.id ? (
    <input
      value={editedPlayer.singles_all_time}
      onChange={(e) => setEditedPlayer({ ...editedPlayer, singles_all_time: e.target.value })}
    />
  ) : (
    p.singles_all_time
  )}
</td>
<td style={tdStyle}>
  {editingId === p.id ? (
    <input
      value={editedPlayer.doubles_season}
      onChange={(e) => setEditedPlayer({ ...editedPlayer, doubles_season: e.target.value })}
    />
  ) : (
    p.doubles_season
  )}
</td>
<td style={tdStyle}>
  {editingId === p.id ? (
    <input
      value={editedPlayer.doubles_all_time}
      onChange={(e) => setEditedPlayer({ ...editedPlayer, doubles_all_time: e.target.value })}
    />
  ) : (
    p.doubles_all_time
  )}
</td>

              {isAdmin && (
                <td style={tdStyle}>
                 {editingId === p.id ? (
  <>
    <button
      className="save-button"
      onClick={async () => {
        const res = await fetch(`${API_BASE_URL}/players/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editedPlayer),
        });
        if (res.ok) {
          setEditingId(null);
          fetchPlayers();
        } else {
          alert("Failed to update player.");
        }
      }}
    >
      Save
    </button>
    <button
      className="cancel-button"
      onClick={() => setEditingId(null)}
      style={{ marginLeft: 6 }}
    >
      Cancel
    </button>
  </>
) : (
  <button
    className="edit-button"
    onClick={() => {
      setEditingId(p.id);
      setEditedPlayer(p);
    }}
  >
    Edit
  </button>
)}

                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && (
        <>
          {!showForm ? (
            <button className="nav-button" style={{ marginTop: 20 }} onClick={() => setShowForm(true)}>
              Add Player
            </button>
          ) : (
            <form onSubmit={handleSubmit} style={{ marginTop: 20, textAlign: "left" }}>
              <input name="name" placeholder="Name" value={newPlayer.name} onChange={handleChange} required />
              <input name="year" placeholder="Year" value={newPlayer.year} onChange={handleChange} required />
              <input name="singles_season" placeholder="Singles (Season)" value={newPlayer.singles_season} onChange={handleChange} required />
              <input name="singles_all_time" placeholder="Singles (All-Time)" value={newPlayer.singles_all_time} onChange={handleChange} required />
              <input name="doubles_season" placeholder="Doubles (Season)" value={newPlayer.doubles_season} onChange={handleChange} required />
              <input name="doubles_all_time" placeholder="Doubles (All-Time)" value={newPlayer.doubles_all_time} onChange={handleChange} required />
              <div style={{ marginTop: 10 }}>
                <button type="submit" className="nav-button">Submit</button>
                <button type="button" onClick={() => setShowForm(false)} className="nav-button" style={{ marginLeft: 10 }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

const thStyle = {
  border: "1px solid #ccc",
  padding: "10px",
  fontWeight: "bold",
  textAlign: "center"
};

const tdStyle = {
  border: "1px solid #ccc",
  padding: "10px",
  textAlign: "center"
};
