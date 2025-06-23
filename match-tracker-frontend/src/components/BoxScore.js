// BoxScore.js
import React from "react";
import "../styles.css";

export default function BoxScore({ match, onClose }) {
  if (!match || !match.boxScore) return null;

  return (
    <div className="boxscore-popup">
      <button onClick={onClose} style={{ float: "right" }}>
        Close
      </button>
      <h3>Box Score vs {match.opponent}</h3>
      <p>
        Final Team Score: {match.teamScore[0]} – {match.teamScore[1]}
      </p>
      <ul className="boxscore-list">
        {match.boxScore.map((m, i) => (
          <li key={i} className="boxscore-item">
            <strong>
              {m.matchType} #{m.matchNumber}:
            </strong>{" "}
            {m.player1} vs {m.player2} — <em>Winner: {m.winner}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
