import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles.css";
import BoxScore from "./BoxScore";
import { useAdmin } from "../AdminContext";
import BackButton from "./BackButton";

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

function MatchCard({ match, isAdmin, onDelete }) {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 15, border: "2px solid #ccc", borderRadius: 10, marginBottom: 12 }}>
      <div style={{ fontWeight: "bold", fontSize: "1.1em" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <img src="/saint-leo-logo.png" alt="Saint Leo" style={{ height: 24 }} />
          <span>Saint Leo vs {match.opponent}</span>
        </div>
      </div>
      <div style={{ marginTop: 4, color: "#555" }}>
        {formatDateTime(match.date)} @ {match.location}
      </div>
      <div style={{ marginTop: 8 }}>
        {match.status === "completed" && (
          <button onClick={() => navigate(`/boxscore/${match.id}`)} className="lineup-button" style={{ marginRight: 8 }}>
            View Box Score
          </button>
        )}
        {isAdmin && (
          <button className="delete-button" onClick={() => onDelete(match.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export function Schedule({ onSelect = () => {}, showSchedule = true, onCloseSchedule = () => {} }) {
  const { isAdmin } = useAdmin();
  const [matches, setMatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newMatch, setNewMatch] = useState({ id: "", date: "", opponent: "", location: "" });
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
  const nextMatch = sortedMatches.find((m) => new Date(m.date) > now && m.status === "scheduled");
  const upcomingMatches = sortedMatches.filter((m) => m.status === "scheduled" && m.id !== nextMatch?.id);
  const pastMatches = sortedMatches.filter((m) => m.status === "completed");
  const liveMatch = sortedMatches.find((m) => m.status === "live");

  useEffect(() => {
    if (!nextMatch) return;

    const updateCountdown = () => {
      const timeLeft = new Date(nextMatch.date) - new Date();
      if (timeLeft <= 0) {
        setCountdown("Match has started");
        return;
      }
      setCountdown(formatTimeDiff(timeLeft));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextMatch]);

  const handleChange = (e) => {
    setNewMatch({ ...newMatch, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:8000/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date(newMatch.date).toISOString(),
          opponent: newMatch.opponent,
          location: newMatch.location,
          status: "scheduled",
          match_number: Date.now(),
        }),
      });

      if (!response.ok) throw new Error("Failed to create match");

      setShowForm(false);
      setNewMatch({ id: "", date: "", opponent: "", location: "" });
      fetchMatches();
    } catch (error) {
      console.error("Error creating match:", error);
    }
  };

  const handleDeleteMatch = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this match?");
    if (!confirmDelete) return;

    const res = await fetch(`http://127.0.0.1:8000/schedule/${id}`, { method: "DELETE" });
    if (res.ok) fetchMatches();
    else alert("Failed to delete match");
  };

  if (!showSchedule) return null;

  return (
    <div className="card" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      <BackButton />
      <h2 className="home-title">Schedule Page</h2>

      {isAdmin && (
        <button className="nav-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add Match"}
        </button>
      )}

{liveMatch && (
  <div className="next-match-container" style={{ borderColor: "#1565c0", marginBottom: 20 }}>
    <h3 className="match-heading">Live Now</h3>
    <p className="match-info">
      {formatDateTime(liveMatch.date)} — {liveMatch.opponent} ({liveMatch.location})
    </p>
    <a href="/livescore">
      <button className="event-button">Go to Live Score</button>
    </a>
  </div>
)}


      {isAdmin && showForm && (
        <form onSubmit={handleSubmit} className="match-form" style={{ marginTop: 10 }}>
          <input type="datetime-local" name="date" value={newMatch.date} onChange={handleChange} required />
          <input name="opponent" placeholder="Opponent" value={newMatch.opponent} onChange={handleChange} required />
          <input name="location" placeholder="Location" value={newMatch.location} onChange={handleChange} required />
          <button type="submit" className="nav-button">Submit</button>
        </form>
      )}

      {nextMatch && (
        <>
          <h3 style={{ marginTop: 30 }}>Next Match</h3>
          <MatchCard match={nextMatch} isAdmin={isAdmin} onDelete={handleDeleteMatch} />
          {countdown && (
            <div style={{ marginTop: 8, color: "#333" }}>
              Starts in: <span style={{ fontWeight: "bold" }}>{countdown}</span>
            </div>
          )}
        </>
      )}

      <h3 style={{ marginTop: 30 }}>Upcoming Matches</h3>
      {upcomingMatches.length > 0 ? (
        upcomingMatches.map((match) => (
          <MatchCard key={match.id} match={match} isAdmin={isAdmin} onDelete={handleDeleteMatch} />
        ))
      ) : (
        <p>No upcoming matches.</p>
      )}

      <h3 style={{ marginTop: 30 }}>Past Matches</h3>
      {pastMatches.length > 0 ? (
        pastMatches.map((match) => (
          <MatchCard key={match.id} match={match} isAdmin={isAdmin} onDelete={handleDeleteMatch} />
        ))
      ) : (
        <p>No past matches.</p>
      )}
    </div>
  );
}
