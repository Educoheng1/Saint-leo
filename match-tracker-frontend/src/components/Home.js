import { Link } from "react-router-dom";
import "../styles.css";
import { useAdmin } from "../AdminContext";

export default function Home() {
  const { isAdmin } = useAdmin();

  return (
    <div className="home-container">
      <div className="home-card">
        <div className="home-logo-wrapper">
          <img
            src="/saint-leo-logo.png"
            alt="Saint Leo University Logo"
            className="home-logo"
          />
        </div>

        <h1 className="home-title">Saint Leo Tennis</h1>

        <p style={{ color: "#666", fontSize: "16px", marginBottom: "20px" }}>
          Welcome {isAdmin ? "Admin" : "Guest"}
        </p>

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
    </div>
  );
}
