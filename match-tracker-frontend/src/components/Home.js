import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Saint Leo Tennis</h1>
      <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link to="/schedule">
          <button>View Schedule</button>
        </Link>
        <Link to="/players">
          <button>Player List</button>
        </Link>
        <Link to="/livescore">
          <button>Live Score</button>
        </Link>
      </nav>
    </div>
  );
}
