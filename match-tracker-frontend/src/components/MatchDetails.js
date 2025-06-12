export default function MatchDetails({ match }) {
    if (!match) return null;
    return (
      <div>
        <h2>
          Lineup for {match.date} vs {match.opponent}
        </h2>
      </div>
    );
  }
  