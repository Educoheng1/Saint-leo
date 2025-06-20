import { Link } from "react-router-dom";
import "../styles.css";

export default function Home() {
  return (
    <div className="home-container">
      <img
        src="/saint-leo-logo.png"
        alt="Saint Leo University Logo"
        className="home-logo"
      />
      <h1 className="home-title">Saint Leo Tennis</h1>
      <nav className="home-nav">
        <Link to="/schedule">
          <button className="nav-button">View Schedule</button>
        </Link>
        <Link to="/players">
          <button className="nav-button">Player List</button>
        </Link>
        <Link to="/livescore">
          <button className="nav-button">Live Score</button>
        </Link>
      </nav>
    </div>
  );
}
