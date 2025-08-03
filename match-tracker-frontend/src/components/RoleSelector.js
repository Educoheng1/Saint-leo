import React, { useState } from "react";
import "../styles.css";

export default function RoleSelector({ onSelect }) {
  const [showPassword, setShowPassword] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [error, setError] = useState("");

  const handleAdminClick = () => {
    setShowPassword(true);
    setError("");
  };

  const handlePasswordSubmit = () => {
    if (inputPassword === "123") {
      onSelect("admin");
    } else {
      setError("Incorrect password");
    }
  };

  return (
    <div className="home-container">
      <img
        src="/saint-leo-logo.png"
        alt="Saint Leo University Logo"
        className="home-logo"
      />
      <h2 className="home-title">Who are you?</h2>

      {!showPassword ? (
        <div className="home-nav">
          <button onClick={handleAdminClick} className="nav-button">
            Admin
          </button>
          <button
  onClick={() => {
    const name = window.prompt("Enter your name:");
    if (name && name.trim()) {
      localStorage.setItem("guestName", name.trim());
      onSelect("guest");
    } else {
      alert("Please enter a valid name to continue as a guest.");
    }
  }}
  className="nav-button"
>
  Guest
</button>

        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "300px", width: "100%" }}>
          <input
  type="password"
  placeholder="Enter Admin Password"
  value={inputPassword}
  onChange={(e) => setInputPassword(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      handlePasswordSubmit();
    }
  }}
  className="match-form input"
/>
          <button onClick={handlePasswordSubmit} className="nav-button">
            Enter
          </button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        
        </div>
      )}
    </div>
  );
}
