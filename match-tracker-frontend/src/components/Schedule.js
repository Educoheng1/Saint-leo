import React, { useEffect, useState } from "react";
import LineupEditor from "./LineupEditor";
import "../styles.css"; 
import BoxScore from "./BoxScore";

export function Schedule({
  onSelect = () => {},
  showSchedule = true,
  onCloseSchedule = () => {},
}) {
  const [matches, setMatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const isAdmin = true;
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [boxScoreMatch, setBoxScoreMatch] = useState(null);

  const [newMatch, setNewMatch] = useState({
    id: "",
    date: "",
    opponent: "",
    location: "",
  });

  const fetchMatches = () => {
    fetch("http://127.0.0.1:8000/schedule")
      .then((res) => res.json())
      .then(setMatches)
      .catch((err) => console.error("Failed to fetch matches:", err));
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleChange = (e) => {
    setNewMatch({ ...newMatch, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch("http://127.0.0.1:8000/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newMatch, id: parseInt(newMatch.id) }),
    });

    if (response.ok) {
      const created = await response.json();
      setMatches([...matches, { ...newMatch, id: created.id }]);
      setShowForm(false);
      setNewMatch({ id: "", date: "", opponent: "", location: "" });
    } else {
      alert("Failed to add match.");
    }
  };

  const handleDeleteMatch = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this match?");
    if (!confirmDelete) return;

    const res = await fetch(`http://127.0.0.1:8000/schedule/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      fetchMatches();
    } else {
      alert("Failed to delete match");
    }
  };

  if (!showSchedule) return null;

  return (
    <div className="card">
      <button className="nav-button" onClick={onCloseSchedule} style={{ float: "right" }}>
        Close
      </button>
      <h2 className="home-title">Schedule Page</h2>

      <button className="nav-button" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "Add Match"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="match-form">
          <input name="id" placeholder="ID" value={newMatch.id} onChange={handleChange} required />
          <input type="datetime-local" name="date" value={newMatch.date} onChange={handleChange} required />
          <input name="opponent" placeholder="Opponent" value={newMatch.opponent} onChange={handleChange} required />
          <input name="location" placeholder="Location" value={newMatch.location} onChange={handleChange} required />
          <button type="submit" className="nav-button">Submit</button>
        </form>
      )}

      {matches.length === 0 ? (
        <p>No matches scheduled.</p>
      ) : (
        <ul style={{ marginTop: 10 }}>
          {matches.map((match) => (
            <li key={match.id} style={{ marginBottom: 6 }}>
              <button className="match-button" onClick={() => onSelect(match)} style={{ marginRight: 10 }}>
                {match.date} - {match.opponent} ({match.location})
              </button>

              {match.status === "completed" && (
                <button onClick={() => setBoxScoreMatch(match)} className="lineup-button">
                  View Box Score
                </button>
              )}

              {isAdmin && (
                <>
                  <button className="delete-button" onClick={() => handleDeleteMatch(match.id)}>
                    Delete
                  </button>
                  <button className="lineup-button" onClick={() => setEditingMatchId(match.id)}>
                    Set Lineup
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editingMatchId && (
        <LineupEditor
          matchId={editingMatchId}
          onClose={() => setEditingMatchId(null)}
        />
      )}

      {boxScoreMatch && (
        <BoxScore match={boxScoreMatch} onClose={() => setBoxScoreMatch(null)} />
      )}
    </div>
  );
}
