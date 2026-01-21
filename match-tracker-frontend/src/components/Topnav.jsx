// src/components/TopNav.js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import LoginModal from "../components/LoginModal";
import { useAuth } from "../AuthContext";

export default function TopNav({ hasLive }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const toggleMenu = () => setOpen((prev) => !prev);
  const handleLinkClick = () => setOpen(false);

  // Prefer "First Last", fallback to email, then Guest
  const displayName = user
    ? (user.first_name || user.last_name
        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
        : user.email)
    : "Guest";

  return (
    <header className="sl-topnav">
      {/* single row: brand left, name + login/logout + burger right */}
      <div className="sl-topnav-main">
        <div className="sl-brand">
        <Link to="/dashboard" className="sl-brand">
  <img
     src="/saint-leo-logo.png"
     alt="Saint Leo"
     className="sl-brand-logo"
  />
  <span className="sl-brand-title">LeoScore</span>
</Link>
</div>

        <div className="sl-topnav-right">
          <span className="sl-username">{displayName}</span>

          {user ? (
            // LOGGED IN → show Log out
            <button
              type="button"
              className="sl-login-btn"
              onClick={logout}
            >
              Log out
            </button>
          ) : (
            // LOGGED OUT → show Log in (opens modal)
            <button
              type="button"
              className="sl-login-btn"
              onClick={() => setShowLogin(true)}
            >
              Log in
            </button>
          )}

          <button
            className="sl-burger"
            onClick={toggleMenu}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
        </div>
      </div>

      {/* desktop nav bar (centered) */}
      <nav className="sl-navlinks sl-navlinks-desktop">
        <Link to="/dashboard" className="sl-navlink">
          Dashboard
        </Link>
        <Link to="/schedule" className="sl-navlink">
          Schedule
        </Link>
        <Link to="/players" className="sl-navlink">
          Roster
        </Link>
        {hasLive && (
          <Link to="/livescore" className="sl-navlink sl-navlink-accent">
            Live Scores
          </Link>
        )}
        <a
          href="https://ets.rocks/4o1T9nO"
          target="_blank"
          rel="noreferrer"
          className="sl-navlink sl-navlink-donate"
        >
          Donate
        </a>
        <Link to="/admin" className="sl-navlink">
          Admin Panel
        </Link>
      </nav>

      {/* mobile full-screen overlay menu */}
      {open && (
        <div className="sl-nav-overlay">
          <nav className="sl-navlinks-mobile">
            <Link
              to="/dashboard"
              className="sl-navlink-mobile"
              onClick={handleLinkClick}
            >
              Dashboard
            </Link>
            <Link
              to="/schedule"
              className="sl-navlink-mobile"
              onClick={handleLinkClick}
            >
              Schedule
            </Link>
            <Link
              to="/players"
              className="sl-navlink-mobile"
              onClick={handleLinkClick}
            >
              Roster
            </Link>
            {hasLive && (
              <Link
                to="/livescore"
                className="sl-navlink-mobile sl-navlink-mobile-accent"
                onClick={handleLinkClick}
              >
                Live Scores
              </Link>
            )}
            <a
              href="https://ets.rocks/4o1T9nO"
              target="_blank"
              rel="noreferrer"
              className="sl-navlink-mobile sl-navlink-mobile-donate"
              onClick={handleLinkClick}
            >
              Donate
            </a>
            <Link
              to="/admin"
              className="sl-navlink-mobile"
              onClick={handleLinkClick}
            >
              Admin Panel
            </Link>
          </nav>
        </div>
      )}

      {/* login popup */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </header>
  );
}
