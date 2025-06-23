import React, { useEffect, useState } from "react";
import "../styles.css";
import BoxScore from "./BoxScore";

function formatTimeDiff(diff) {
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}


export function Schedule({
  onSelect = () => {},
  showSchedule = true,
  onCloseSchedule = () => {},
}) {
  const [matches, setMatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const isAdmin = true;
  const [boxScoreMatch, setBoxScoreMatch] = useState(null);
  const [newMatch, setNewMatch] = useState({
    id: "",
    date: "",
    opponent: "",
    location: "",
  });
  const [countdown, setCountdown] = useState("");

  const fetchMatches = () => {
    fetch("http://127.0.0.1:8000/schedule")
      .then((res) => res.json())
      .then(setMatches)
      .catch((err) => console.error("Failed to fetch matches:", err));
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  const now = new Date();
  const nextMatch = sortedMatches.find(m => new Date(m.date) > now);
  const restMatches = sortedMatches.filter(m => m !== nextMatch);

  useEffect(() => {
    if (!nextMatch) return;
    const interval = setInterval(() => {
      const timeLeft = new Date(nextMatch.date) - new Date();
      setCountdown(formatTimeDiff(timeLeft));
    }, 1000);
    return () => clearInterval(interval);
  }, [nextMatch]);

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
    <div className="card" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
   
      <h2 className="home-title">Schedule Page</h2>

      <button className="nav-button" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "Add Match"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="match-form" style={{ marginTop: 10 }}>
          <input name="id" placeholder="ID" value={newMatch.id} onChange={handleChange} required />
          <input type="datetime-local" name="date" value={newMatch.date} onChange={handleChange} required />
          <input name="opponent" placeholder="Opponent" value={newMatch.opponent} onChange={handleChange} required />
          <input name="location" placeholder="Location" value={newMatch.location} onChange={handleChange} required />
          <button type="submit" className="nav-button">Submit</button>
        </form>
      )}

{nextMatch && (
  <div style={{ marginTop: 20, padding: 15, border: "2px solid #4CAF50", borderRadius: 10 }}>
  <h3 style={{ marginBottom: 8 }}>Next Match</h3>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
    <img src="/saint-leo-logo.png" alt="Saint Leo" style={{ height: 24 }} />
    <span style={{ fontWeight: "bold", fontSize: "1.1em" }}>Saint Leo vs {nextMatch.opponent}</span>
  </div>
  <div style={{ marginTop: 4, color: "#555" }}>
    {formatDateTime(nextMatch.date)} @ {nextMatch.location}
  </div>
  <div style={{ marginTop: 8, color: "#333" }}>
    Starts in: <span style={{ fontWeight: "bold" }}>{countdown}</span>
  </div>
</div>

)}

<div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: 10 }}>
  {restMatches.map((match) => (
    <div key={match.id} style={{ padding: 15, border: "2px solid #ccc", borderRadius: 10 }}>
      <div style={{ fontWeight: "bold", fontSize: "1.1em" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
  <img src="/saint-leo-logo.png" alt="Saint Leo" style={{ height: 24 }} />
  <span style={{ fontWeight: "bold" }}>Saint Leo vs {match.opponent}</span>
</div>
      </div>
      <div style={{ marginTop: 4, color: "#555" }}>
        {formatDateTime(match.date)} @ {match.location}
      </div>
      <div style={{ marginTop: 8 }}>
        {match.status === "completed" && (
          <button onClick={() => setBoxScoreMatch(match)} className="lineup-button" style={{ marginRight: 8 }}>
            View Box Score
          </button>
        )}
        {isAdmin && (
          <button className="delete-button" onClick={() => handleDeleteMatch(match.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  ))}
</div>

      {boxScoreMatch && (
        <BoxScore match={boxScoreMatch} onClose={() => setBoxScoreMatch(null)} />
      )}
    </div>
  );
}
