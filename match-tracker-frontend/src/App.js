import { useEffect, useState } from "react";
import { Schedule } from "./components/Schedule";
import MatchDetails from "./components/MatchDetails";
import PlayerList from "./components/PlayerList";

function App() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [lineup, setLineup] = useState([]);
  const [players, setPlayers] = useState({});
  const [showSchedule, setShowSchedule] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [liveMatches, setLiveMatches] = useState([]);
  const [showPlayerList, setShowPlayerList] = useState(false);

  // Fetch live matches only when Live Matches view is shown
  useEffect(() => {
    if (showLive) {
      fetch("http://127.0.0.1:8000/matches/live")
        .then((res) => res.json())
        .then(setLiveMatches);
    }
  }, [showLive]);

  // Fetch player ID → name map
  useEffect(() => {
    fetch("http://127.0.0.1:8000/players")
      .then((res) => res.json())
      .then((data) => {
        const map = {};
        data.forEach((p) => (map[p.id] = p.name));
        setPlayers(map);
      });
  }, []);

  // Fetch lineup when match selected
  useEffect(() => {
    if (selectedMatch) {
      fetch("http://127.0.0.1:8000/lineups")
        .then((res) => res.json())
        .then((data) =>
          setLineup(data.filter((l) => l.match_id === selectedMatch.id))
        );
    }
  }, [selectedMatch]);

  // Fetch schedule matches only when Schedule view is shown
  const handleScheduleClick = () => {
    fetch("http://127.0.0.1:8000/matches/schedule")
      .then((res) => res.json())
      .then((data) => {
        console.log("Schedule matches:", data); // Now you can check!
        setMatches(data);
      });
    setShowSchedule(true);
    setShowLive(false);
    setShowPlayerList(false);
  };
  
  return (
    <div style={{ padding: 20 }}>
      <h1>Saint Leo Match Tracker</h1>
      <button onClick={handleScheduleClick}>
        Schedule
      </button>
      <button
        onClick={() => {
          setShowLive(true);
          setShowSchedule(false);
          setShowPlayerList(false);
        }}
        style={{ marginLeft: 8 }}
      >
        Live Matches
      </button>
      <button
        onClick={() => {
          setShowPlayerList(true);
          setShowSchedule(false);
          setShowLive(false);
        }}
        style={{ marginLeft: 8 }}
      >
        Player List
      </button>

      {/* Show Schedule Popup */}
      {showSchedule && (
  <Schedule
  matches={matches}
  showSchedule={true}
  onCloseSchedule={() => setShowSchedule(false)}
  onSelect={setSelectedMatch}
/>

)}

      {/* Show Player List Popup */}
      {showPlayerList && (
        <PlayerList onClose={() => setShowPlayerList(false)} />
      )}

      {/* Show Live Matches Popup */}
      {showLive && (
        <div style={{ background: "#ffe", padding: 20, borderRadius: 8 }}>
          <button
            onClick={() => setShowLive(false)}
            style={{ float: "right" }}
          >
            Close
          </button>
          <h2>Live Matches</h2>
          <Schedule matches={liveMatches} onSelect={setSelectedMatch} />
        </div>
      )}

      {/* Main Schedule list (only if no popups are open) */}
      {/* Remove this block if you want nothing on the home page */}
      {/* 
      {!showLive && !showSchedule && !showPlayerList && (
        <Schedule matches={matches} onSelect={setSelectedMatch} />
      )} 
      */}

      {selectedMatch && (
        <MatchDetails
          match={selectedMatch}
          lineup={lineup}
          players={players}
        />
      )}
    </div>
  );
}

export default App;
