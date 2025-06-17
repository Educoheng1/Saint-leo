import React, { useEffect, useState } from "react";

export function Schedule({
  onSelect = () => {},
  showSchedule = true,
  onCloseSchedule = () => {},
}) {
  const [matches, setMatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newMatch, setNewMatch] = useState({
    id: "",
    date: "",
    opponent: "",
    location: "",
  });

  useEffect(() => {
    fetch("http://127.0.0.1:8000/schedule")
      .then((res) => res.json())
      .then(setMatches)
      .catch((err) => console.error("Failed to fetch matches:", err));
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

  if (!showSchedule) return null;

  return (
    <div style={{ background: "#f0f0f0", padding: 20, borderRadius: 8 }}>
      <button onClick={onCloseSchedule} style={{ float: "right" }}>
        Close
      </button>
      <h2>Schedule Page</h2>

      <button onClick={() => setShowForm(!showForm)}>
        {showForm ? "Cancel" : "Add Match"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginTop: 10 }}>
          <input
            name="id"
            placeholder="ID"
            value={newMatch.id}
            onChange={handleChange}
            required
          />
      <input
  type="datetime-local"
  name="date"
  placeholder="Date"
  value={newMatch.date}
  onChange={handleChange}
  required
/>
          <input
            name="opponent"
            placeholder="Opponent"
            value={newMatch.opponent}
            onChange={handleChange}
            required
          />
          <input
            name="location"
            placeholder="Location"
            value={newMatch.location}
            onChange={handleChange}
            required
          />
          <button type="submit">Submit</button>
        </form>
      )}

      {matches.length === 0 ? (
        <p>No matches scheduled.</p>
      ) : (
        <ul style={{ marginTop: 10 }}>
          {matches.map((match) => (
            <li key={match.id}>
              <button onClick={() => onSelect(match)}>
                {match.date} - {match.opponent} ({match.location})
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
