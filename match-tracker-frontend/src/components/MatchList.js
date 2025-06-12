export default function MatchList({ matches, onSelect }) {
    return (
      <ul>
        {matches.map((match) => (
          <li key={match.id}>
            <button onClick={() => onSelect(match)}>
              {match.date} vs {match.opponent} ({match.location})
            </button>
          </li>
        ))}
      </ul>
    );
  }
  