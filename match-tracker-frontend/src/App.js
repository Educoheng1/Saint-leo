import { useEffect, useState } from "react";
import MatchList from "./components/MatchList";
import MatchDetails from "./components/MatchDetails";

function App() {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [lineup, setLineup] = useState([]);
  const [players, setPlayers] = useState({});

  // Fetch all matches
  useEffect(() => {
    fetch("http://127.0.0.1:8000/matches")
      .then((res) => res.json())
      .then(setMatches);
  }, []);

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

  return (
    <div style={{ padding: 20 }}>
      <h1>Saint Leo Match Tracker</h1>

      <MatchList matches={matches} onSelect={setSelectedMatch} />

      {selectedMatch && (
        <MatchDetails match={selectedMatch} lineup={lineup} players={players} />
      )}
    </div>
  );
}

export default App;
