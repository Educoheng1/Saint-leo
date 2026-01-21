import { Link } from "react-router-dom";

export default function Header() {
    return (
      <header style={styles.header}>
        <img src="/LeoScore.png" alt="LeoScore" style={styles.logo} />
        <Link to="/dashboard" className="sl-brand">
  <img src="/LeoScore.png" alt="LeoScore" className="sl-logo" />
  <span className="sl-title">LeoScore</span>
</Link>
      </header>
    );
  }

const styles = {
  header: {
    backgroundColor: "#1f4d2b", // same green as logo
    padding: "12px 24px",
    display: "flex",
    alignItems: "center",
  },
  logo: {
    height: "42px",
  },
};
