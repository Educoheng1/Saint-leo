import React, { useEffect, useState } from "react";

export function LiveMatch({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(null);
  const [next, setNext] = useState(null);

  useEffect(() => {
    async function fetchLive() {
      setLoading(true);
      const res = await fetch("http://127.0.0.1:8000/matches/live");
      const data = await res.json();
      setLive(data.live);
      setNext(data.next);
      setLoading(false);
    }
    fetchLive();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (live) {
    const { match, lines } = live;
    return (
      <div style={{ background: "#ffe", padding: 20, borderRadius: 10 }}>
        <h2>Live Match</h2>
        <div>
          <strong>Date:</strong> {new Date(match.date).toLocaleString()}<br />
          <strong>Opponent:</strong> {match.opponent}<br />
          <strong>Location:</strong> {match.location}<br />
        </div>
        <h3>Lines</h3>
        <ul>
          {lines.map(line => (
            <li key={line.id}>
              <b>{line.line_type} {line.line_number}:</b> {line.player1}
              {line.player2 ? " / " + line.player2 : ""}
              {" vs "}
              {line.opponent1}
              {line.opponent2 ? " / " + line.opponent2 : ""}
              {line.score ? ` — ${line.score}` : ""}
              {line.status ? ` (${line.status})` : ""}
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  // No live match, show next scheduled
  if (next) {
    const { match, lines } = next;
    return (
      <div style={{ background: "#eef", padding: 20, borderRadius: 10 }}>
        <h2>No live match right now</h2>
        <h3>Next Match</h3>
        <div>
          <strong>Date:</strong> {new Date(match.date).toLocaleString()}<br />
          <strong>Opponent:</strong> {match.opponent}<br />
          <strong>Location:</strong> {match.location}<br />
        </div>
        <h3>Lines</h3>
        <ul>
          {lines.map(line => (
            <li key={line.id}>
              <b>{line.line_type} {line.line_number}:</b> {line.player1}
              {line.player2 ? " / " + line.player2 : ""}
              {" vs "}
              {line.opponent1}
              {line.opponent2 ? " / " + line.opponent2 : ""}
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  // No matches at all
  return <div>No matches scheduled.</div>;
}
