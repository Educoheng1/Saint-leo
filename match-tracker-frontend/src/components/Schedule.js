import React from "react";

export function Schedule({ matches = [], onSelect, showSchedule, onCloseSchedule }) {
  console.log('Schedule matches prop:', matches);

  if (showSchedule) {
    if (!matches.length) return <p>No upcoming matches.</p>;
    const [nextMatch, ...rest] = matches;

    return (
      <div style={{ background: "#f0f0f0", padding: 20, borderRadius: 8 }}>
        <button onClick={onCloseSchedule} style={{ float: "right" }}>Close</button>
        <h2>Next Match</h2>
        <ul>
          <li key={nextMatch.id}>
            <button onClick={() => onSelect(nextMatch)}>
              {nextMatch.date} vs {nextMatch.opponent} ({nextMatch.location})
            </button>
          </li>
        </ul>
        {rest.length > 0 && (
          <>
            <h3>Rest of the Season</h3>
            <ul>
              {rest.map((match) => (
                <li key={match.id}>
                  <button onClick={() => onSelect(match)}>
                    {match.date} vs {match.opponent} ({match.location})
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  // Normal mode (if showSchedule is false)
  return (
    <ul>
      {matches && matches.map((match) => (
        <li key={match.id}>
          <button onClick={() => onSelect(match)}>
            {match.date} vs {match.opponent} ({match.location})
          </button>
        </li>
      ))}
    </ul>
  );
}
