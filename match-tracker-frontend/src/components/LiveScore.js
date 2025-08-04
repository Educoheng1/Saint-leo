
import React, { useEffect, useState } from "react";
import "../styles.css";
import { useAdmin } from "../AdminContext"; 
import BackButton from "./BackButton";
import API_BASE_URL from "../config"; // adjust path if needed

export function ScoreInput({ value, onChange, onEnter }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      value={
        focused
          ? value === null || isNaN(value) ? "" : value
          : value === null || isNaN(value) ? "–" : value
      }
      className="score-input"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const val = e.target.value;
        onChange(/^\d+$/.test(val) ? parseInt(val) : null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          onEnter();
        }
      }}
    />
  );
}

function PlayerAssignment({ matchIndex, matchType, onSave, onClose, playerList = [] }) {
    const isDoubles = matchType === "Doubles";
  
    const [teamAPlayers, setTeamAPlayers] = useState(["", ""]);
    const [teamBPlayers, setTeamBPlayers] = useState(["", ""]);
  
    const handleTeamAChange = (index, value) => {
      const updated = [...teamAPlayers];
      updated[index] = value;
      setTeamAPlayers(updated);
    };
  
    const handleTeamBChange = (index, value) => {
      const updated = [...teamBPlayers];
      updated[index] = value;
      setTeamBPlayers(updated);
    };
  
    return (
      <div className="lineup-editor">
        <h3 className="lineup-title">Assign Players</h3>
  
        <div style={{ marginBottom: "10px" }}>
          <strong>Team A:</strong>
          {[0, isDoubles ? 1 : null].map(
            (i) =>
              i !== null && (
                <select
                  key={i}
                  value={teamAPlayers[i]}
                  onChange={(e) => handleTeamAChange(i, e.target.value)}
                  className="match-form"
                >
                  <option value="">Select Player {i + 1}</option>
                  {playerList.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )
          )}
        </div>
  
        <div style={{ marginBottom: "10px" }}>
          <strong>Team B:</strong>
          {[0, isDoubles ? 1 : null].map(
            (i) =>
              i !== null && (
                <input
                  key={i}
                  placeholder={`Player ${i + 1}`}
                  value={teamBPlayers[i]}
                  onChange={(e) => handleTeamBChange(i, e.target.value)}
                />
              )
          )}
        </div>
        <button
  className="save-button"
  onClick={() => {
    const teamA = isDoubles ? teamAPlayers.join(" & ") : teamAPlayers[0];
    const teamB = isDoubles ? teamBPlayers.join(" & ") : teamBPlayers[0];

    // Ask who is serving
    const server = window.prompt("Who is serving first? Enter A or B", "A");

    const serveValue = server === "B" ? 1 : 0;

    onSave(matchIndex, teamA, teamB, serveValue); // pass serve info
  }}
>
  Save
</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  }
  
  

function LiveScore() {
  const [nextMatch, setNextMatch] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [scores, setScores] = useState([]);
  const [editableMatches, setEditableMatches] = useState([]);
  const [showAssignIndex, setShowAssignIndex] = useState(null);
  const [teamScore, setTeamScore] = useState([0, 0]); // [Team A, Team B]
  const [eventStarted, setEventStarted] = useState(false);
  const [eventFinished, setEventFinished] = useState(false);
  const [playerList, setPlayerList] = useState([]);



  const { isAdmin } = useAdmin();

  const isEditable = (idx) => editableMatches.includes(idx);

  useEffect(() => {
    fetch(`${API_BASE_URL}/players`)
      .then((res) => res.json())
      .then(setPlayerList)
      .catch((err) => console.error("Failed to fetch players", err));
  }, []);

  useEffect(() => {
    fetch( `${API_BASE_URL}/schedule`)
      .then((res) => res.json())
      .then((data) => {
        const upcoming = data
          .map((match) => ({ ...match, date: new Date(match.date) }))
          .filter((match) => match.date > new Date())
          .sort((a, b) => a.date - b.date);
        setNextMatch(upcoming[0]); // Corrected the set function
      })
      .catch((err) => console.error("Failed to load schedule:", err));
  }, []);
  
  const handleStartMatch = async () => {
    try {
      const matchResponse = await fetch(`${API_BASE_URL}/schedule/${nextMatch.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
  
      if (!matchResponse.ok) throw new Error("Failed to start match");
      const matchData = await matchResponse.json();
      console.log("Team match started:", matchData);
  
      const updated = [...scores];
  
      for (let idx = 0; idx < updated.length; idx++) {
       
  
        const payload = {
          match_id: nextMatch.id,         // Shared for all events
          player1: "",                    // Unknown at start
          player2: "",
          sets: [],
          current_game: [0, 0],
          status: "pending",
          started: false,
          current_serve: null,
        };
  
        const eventRes = await fetch(`${API_BASE_URL}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
  
        if (!eventRes.ok) {
          console.error(`❌ Failed to create event for match ${idx}`, await eventRes.text());
          continue;
        }
  
        const eventData = await eventRes.json();
        console.log(`✅ Created empty event for match ${idx + 1}:`, eventData);
  
        updated[idx].eventId = eventData.id;
        updated[idx].status = "pending";
        updated[idx].started = false;
        updated[idx].sets = [];
        updated[idx].currentGame = [0, 0];
        updated[idx].currentServe = null;
      }
  
      setScores(updated);
      setEventStarted(true);
     
  
    } catch (error) {
      console.error("Error starting all events:", error);
    }
  };

  
  useEffect(() => {
    const checkEventStarted = async () => {
      if (!nextMatch?.id) return;
  
      try {
        const res = await fetch(`${API_BASE_URL}/events/match/${nextMatch.id}`);
        const events = await res.json();
  
        if (events.length > 0) {
          setEventStarted(true);
      
          const restoredScores = events.map((e, idx) => ({
            match_id: e.match_id,
            eventId: e.id,
            player1: e.player1,
            player2: e.player2,
            sets: e.sets,
            currentGame: e.current_game,
            status: e.status,
            started: e.started,
            currentServe: e.current_serve,
            matchType: e.sets.length === 3 ? "Singles" : "Doubles",
            matchNumber: idx + 1,
            winner: e.winner,
          }));
          setScores(restoredScores);
          console.log("✅ Restored match from DB:", restoredScores);
        } else {
          console.log("🟡 No events found for this match");
        }
      } catch (err) {
        console.error("❌ Error fetching event data:", err);
      }
    };
  
    checkEventStarted();
  }, [nextMatch]);
  
  

  const fetchScore = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/schedule`);
      const schedule = await res.json();
  
      const matchTemplate = [
        { matchType: "Doubles", matchNumber: 1 },
        { matchType: "Doubles", matchNumber: 2 },
        { matchType: "Doubles", matchNumber: 3 },
        { matchType: "Singles", matchNumber: 1 },
        { matchType: "Singles", matchNumber: 2 },
        { matchType: "Singles", matchNumber: 3 },
        { matchType: "Singles", matchNumber: 4 },
        { matchType: "Singles", matchNumber: 5 },
        { matchType: "Singles", matchNumber: 6 },
      ];
  
      const enriched = matchTemplate.map((template) => {
        const backendMatch = schedule.find(
          (m) =>
            m.match_type === template.matchType &&
            m.match_number === template.matchNumber
        );
  
        return {
          ...template,
          match_id: backendMatch?.id,
          player1: backendMatch?.player1 || null,
          player2: backendMatch?.player2 || null,
          sets: [],
          currentGame: [],
          status: "pending",
          started: false,
        };
      });
  
      console.log("Enriched match list with match IDs:", enriched.map((m) => m.match_id));
      setScores(enriched);
    } catch (err) {
      console.error("Failed to fetch scores", err);
    }
  };
  
const handleShowScore = async () => {
  setShowScore(true);

  const matchTemplate = [
    { matchType: "Doubles", matchNumber: 1 },
    { matchType: "Doubles", matchNumber: 2 },
    { matchType: "Doubles", matchNumber: 3 },
    { matchType: "Singles", matchNumber: 1 },
    { matchType: "Singles", matchNumber: 2 },
    { matchType: "Singles", matchNumber: 3 },
    { matchType: "Singles", matchNumber: 4 },
    { matchType: "Singles", matchNumber: 5 },
    { matchType: "Singles", matchNumber: 6 },
  ];

  try {
    const res = await fetch(`${API_BASE_URL}/events/match/${nextMatch.id}`);
    const events = await res.json();

    const merged = matchTemplate.map((template, idx) => {
      const dbEvent = events[idx]; // Match by index (or enhance later by type/number)

      if (dbEvent) {
        return {
          ...template,
          match_id: dbEvent.match_id,
          eventId: dbEvent.id,
          player1: dbEvent.player1,
          player2: dbEvent.player2,
          sets: dbEvent.sets,
          currentGame: dbEvent.current_game,
          status: dbEvent.status,
          started: dbEvent.started,
          currentServe: dbEvent.current_serve,
          winner: dbEvent.winner,
        };
      } else {
        return {
          ...template,
          match_id: null,
          eventId: null,
          player1: null,
          player2: null,
          sets: [],
          currentGame: [],
          status: "pending",
          started: false,
          currentServe: null,
        };
      }
    });

    setScores(merged);
    console.log("✅ Merged template with DB events:", merged);
  } catch (err) {
    console.error("❌ Error merging fallback with DB events:", err);
  }
};

  
  const handleSave = async (idx) => {
    setEditableMatches((prev) => prev.filter((i) => i !== idx));
    const updatedMatch = scores[idx];
  
    try {
      const response = await fetch(`${API_BASE_URL}/events/${updatedMatch.eventId}`, {
        method: "PUT", // Use PUT for updates
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: updatedMatch.match_id,
          player1: updatedMatch.player1,
          player2: updatedMatch.player2,
          sets: updatedMatch.sets,
          current_game: updatedMatch.currentGame,
          status: updatedMatch.status,
          started: updatedMatch.started,
          current_serve: updatedMatch.currentServe,
          winner: updatedMatch.winner, // ✅ correct scop


        }),
      });
      if (!response.ok) throw new Error("Failed to update event data");
      const data = await response.json();
      console.log("Event updated:", data);
    } catch (err) {
      console.error("Failed to update event:", err);
    }
  };
  
  useEffect(() => {
    const savedScore = localStorage.getItem("teamScore");
    if (savedScore) {
      setTeamScore(JSON.parse(savedScore));
    }
  }, []);
  
  return (
    <div style={{ padding: 20 }}>
      <BackButton />
      <h2 className="page-title">Live Score</h2>
      <div className="next-match-container">
        {!nextMatch ? (
          <p className="no-match">No upcoming matches.</p>
        ) : (
          <>
            <h3 className="match-heading">Playing Now</h3>
            <p className="match-info">
              {nextMatch.date.toLocaleString()} — {nextMatch.opponent} ({nextMatch.location})
            </p>
            {isAdmin && (!eventStarted || eventFinished) && (
  <button className="event-button" onClick={handleStartMatch}>
    Start Event
  </button>
)}


{isAdmin && eventStarted && !eventFinished && (
  <button
    className="event-button"
    onClick={async () => {
      // 🔒 1. Check if all matches are completed
      const incomplete = scores.filter((s) => s.status !== "completed");
      if (incomplete.length > 0) {
        alert("You must complete all 9 matches before finishing the event.");
        return;
      }

      try {
        // 2. Mark the match as completed
        const res = await fetch(`${API_BASE_URL}/schedule/${nextMatch.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) throw new Error("Failed to mark match as completed");

        console.log("✅ Match marked completed");

        // 3. Reset frontend state
        setScores([]);
        setTeamScore([0, 0]);
        localStorage.removeItem(`teamScore_${nextMatch.id}`);
        setEventStarted(false);
        setEventFinished(true);
        setShowScore(false);
      } catch (err) {
        console.error("❌ Error finishing event:", err);
        alert("Failed to complete event.");
      }
    }}
  >
    Finish Event
  </button>
)}

<h2 className="page-title">Live Score</h2>
{eventStarted && !eventFinished ? (
  <>
    <h3 style={{ marginBottom: 20 }}>
      Current Score: {teamScore[0]} - {teamScore[1]}
    </h3>

    {!showScore && (
  <button className="nav-button" onClick={handleShowScore}>
    Show Live Score
  </button>
)}
  </>
) : eventFinished ? (
  <p style={{ color: "gray" }}>The event has finished. Live scores are no longer available.</p>
) : (
  <p style={{ color: "red" }}>You must start the event to view live scores.</p>
)}
          </>
        )}
      </div>

      {showScore && (
  <>
    <div className="match-list">
      {scores.map((score, idx) => {
        if (!score.started) {
          // ✅ Admins see the match box and the assign button
          return isAdmin ? (
            <div key={idx} className="match-status-box not-started">
              <h3>{score.matchType} #{score.matchNumber}</h3>
              <button className="nav-button" onClick={() => setShowAssignIndex(idx)}>
                Assign Players & Start
              </button>
            </div>
          ) : null; // 👈 guests see nothing
        }

              const sets = score.sets || [];
              const currentGame = score.currentGame || [null, null];
              const players = [score.player1 || "Player 1", score.player2 || "Player 2"];

              return (
                <div
                  key={idx}
                  className={`match-status-box ${score.status === "live" ? "live" : "completed"}`}
                >
                  <div className="match-header">
                    <h3 className="match-title">{score.matchType} #{score.matchNumber}</h3>
                    <div>
  {isEditable(idx) ? (
    <button onClick={() => handleSave(idx)} className="save-button">
      Save
    </button>
  ) : isAdmin && (
    <>
      <button
        onClick={() => setEditableMatches((prev) => [...prev, idx])}
        className="edit-button"
      >
        Edit Score
      </button>
      {score.status === "live" && (
        <button
          className="end-button"
          onClick={async () => {
            const winner = window.prompt("Who won? (A or B)")?.toUpperCase();
          
            if (winner !== "A" && winner !== "B") {
              alert("Invalid input. Type A or B.");
              return;
            }
            if (winner === "A") {
                const newScore = [teamScore[0] + 1, teamScore[1]];
                setTeamScore(newScore);
                localStorage.setItem(`teamScore_${nextMatch.id}`, JSON.stringify(newScore));

              } else if (winner === "B") {
                const newScore = [teamScore[0], teamScore[1] + 1];
                setTeamScore(newScore);
                localStorage.setItem(`teamScore_${nextMatch.id}`, JSON.stringify(newScore));

              }
            const updated = [...scores];
            updated[idx].status = "completed";
            updated[idx].winner = winner; // ✅ mark who won
            setScores(updated);
          
            const match = updated[idx];
          
            try {
              await fetch(`${API_BASE_URL}/events/${match.eventId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  match_id: match.match_id,
                  player1: match.player1,
                  player2: match.player2,
                  sets: match.sets,
                  current_game: match.currentGame,
                  status: "completed",
                  started: match.started,
                  current_serve: match.currentServe,
                  winner: winner, // 👈 only if you add this to the DB
                }),
              });
              console.log(`✅ Match ${idx + 1} marked as completed`);
            } catch (err) {
              console.error("❌ Failed to update match:", err);
            }
          }}
          
        >
          End Match
        </button>
      )}
    </>
  )}
</div>

                  </div>

                  <table className="match-table">
                    <thead>
                      <tr>
                        <th></th>
                        {sets.map((_, index) => <th key={index}>Set {index + 1}</th>)}
                        <th>Game</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player, i) => (
                        <tr key={i}>
   <td style={{ fontWeight: "bold", padding: 8 }}>
  {player}
  {" "}
  {(() => {
    const totalGames = sets.reduce((sum, set) => sum + set.reduce((a, b) => a + b, 0), 0);
    const serverIndex = totalGames % 2 === 0 ? 0 : 1;
    const matchWinner = scores[idx]?.winner;
    const isServer = i === serverIndex;
    const isWinner = (matchWinner === "A" && i === 0) || (matchWinner === "B" && i === 1);

    return (
      <>
        {isServer ? "🎾" : ""}
        {isWinner ? " ✅" : ""}
      </>
    );
  })()}
</td>



                          {sets.map((set, j) => (
                            <td key={j}>
                              {isEditable(idx) ? (
                                <ScoreInput value={set[i]} onChange={(val) => {
                                  const updatedScores = [...scores];
                                  updatedScores[idx].sets[j][i] = val;
                                  setScores(updatedScores);
                                }} onEnter={() => handleSave(idx)} />
                              ) : (
                                set[i] ?? "–"
                              )}
                            </td>
                          ))}
                          <td>
                            {isEditable(idx) ? (
                              <ScoreInput value={currentGame[i]} onChange={(val) => {
                                const updatedScores = [...scores];
                                updatedScores[idx].currentGame[i] = val;
                                setScores(updatedScores);
                              }} onEnter={() => handleSave(idx)} />
                            ) : (
                              currentGame[i] ?? "–"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {showAssignIndex !== null && (
            <div style={{
              position: "fixed",
              top: 100,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              background: "#fff",
              padding: 20,
              border: "2px solid black"
            }}>
<PlayerAssignment
  matchIndex={showAssignIndex}
  matchType={scores[showAssignIndex]?.matchType}
  onSave={async (idx, p1, p2, serveValue) => {
    const updated = [...scores];
    if (!updated[idx]) return;
  
    updated[idx].player1 = p1;
    updated[idx].player2 = p2;
    updated[idx].started = true;
    updated[idx].status = "live";
    updated[idx].sets = updated[idx].matchType === "Singles"
      ? [[0, 0], [0, 0], [0, 0]]
      : [[0, 0]];
    updated[idx].currentGame = [0, 0];
    updated[idx].currentServe = serveValue;

  
    const matchId = nextMatch?.id; // ✅ shared match_id for all events
    if (!matchId) {
      console.error("No shared match ID available");
      return;
    }
  
    try {
      const payload = {
        match_id: matchId, // ✅ same for all
        player1: p1,
        player2: p2,
        sets: updated[idx].sets,
        current_game: updated[idx].currentGame,
        status: "live",
        started: true,
        current_serve: serveValue,
      };
  
      console.log(`Creating event for box ${idx}`, payload);
  
      const response = await fetch(`${API_BASE_URL}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) throw new Error("Failed to create event");
      const data = await response.json();
  
      updated[idx].eventId = data.id;
      setScores(updated);
      setShowAssignIndex(null);
      console.log("Box event created:", data);
    } catch (error) {
      console.error("Error creating event:", error);
    }
  }}
  
  
  onClose={() => setShowAssignIndex(null)}
  playerList={playerList}
/>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default LiveScore;