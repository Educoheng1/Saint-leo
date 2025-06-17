import React, { useEffect, useState } from "react";

function LiveScore() {
  const [nextMatch, setNextMatch] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/schedule")
      .then((res) => res.json())
      .then((data) => {
        const upcoming = data
          .map((match) => ({
            ...match,
            date: new Date(match.date),
          }))
          .filter((match) => match.date > new Date())
          .sort((a, b) => a.date - b.date);

        setNextMatch(upcoming[0]);
      })
      .catch((err) => {
        console.error("Failed to load schedule:", err);
      });
  }, []);

  const fetchScore = () => {
    fetch("http://127.0.0.1:8000/livescore")
      .then((res) => res.json())
      .then(setScore)
      .catch((err) => {
        console.error("Failed to fetch score:", err);
      });
  };

  const handleShowScore = () => {
    setShowScore(true);
    fetchScore();
  };

  const handleCloseScore = () => {
    setShowScore(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Live Score</h2>

      {!nextMatch ? (
        <p>No upcoming matches.</p>
      ) : (
        <div>
          <p>
            <strong>Next Match:</strong>
          </p>
          <p>
            {nextMatch.date.toLocaleString()} — {nextMatch.opponent} (
            {nextMatch.location})
          </p>

          {!showScore && <button onClick={handleShowScore}>Score</button>}
        </div>
      )}

      {showScore && score && (
        <div style={{ marginTop: 20, background: "#f4f4f4", padding: 10, borderRadius: 8 }}>
          <button onClick={handleCloseScore} style={{ float: "right" }}>
            Close
          </button>
          <h3>Current Score</h3>
          <p>
            {score.player1} vs {score.player2}
          </p>
          <p>
            Set 1: {score.set1[0]} - {score.set1[1]}
          </p>
          <p>
            Set 2: {score.set2[0]} - {score.set2[1]}
          </p>
        </div>
      )}
    </div>
  );
}

export default LiveScore;
