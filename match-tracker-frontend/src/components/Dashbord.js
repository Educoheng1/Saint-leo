// src/pages/Dashbord.js
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles.css";
import API_BASE_URL from "../config";
import Footer from "./Footer";
import TopNav from "./Topnav";
import { useAuth } from "../AuthContext";



const TOKEN = localStorage.getItem("token") || "";

const headers = {
  "Content-Type": "application/json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function looksLive(m) {
  const st = String(m?.status ?? "").toLowerCase();
  const started = Boolean(m?.started);
  return (
    (st === "live" || st === "in_progress" || st === "in-progress" || started) &&
    st !== "completed"
  );
}

// NOW RETURNS AN ARRAY OF LIVE MATCHES
async function fetchLiveMatch() {
  // Try dedicated endpoints first
  for (const url of [
    `${API_BASE_URL}/schedule?status=live`,
    `${API_BASE_URL}/schedule?status=Live`,
  ]) {
    const d = await fetchJSON(url);
    if (!d) continue;

    const arr = Array.isArray(d) ? d : [d];
    const lives = arr.filter(looksLive);

    if (lives.length) {
      // hydrate each match with full details if possible
      const full = [];
      for (const m of lives) {
        const details = await fetchJSON(`${API_BASE_URL}/schedule/${m.id}`);
        full.push(details || m);
      }
      return full; // ARRAY OF LIVE MATCHES
    }
  }

  // Fallback: list all and filter
  const all = await fetchJSON(`${API_BASE_URL}/schedule`);
  if (Array.isArray(all)) {
    const lives = all.filter(looksLive);
    if (lives.length) {
      lives.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      return lives; // ARRAY
    }
  }

  return []; // NO LIVE MATCHES
}

async function fetchUpcomingMatch() {
  // Prefer scheduled; otherwise pick nearest future non-completed
  for (const url of [
    `${API_BASE_URL}/schedule?status=scheduled`,
    `${API_BASE_URL}/schedule/upcoming`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(url);
    if (!d) continue;
    const arr = Array.isArray(d)
      ? d
      : d?.items || d?.results || (d ? [d] : []);
    const future = arr
      .filter(
        (m) =>
          m?.date &&
          String(m?.status || "").toLowerCase() !== "completed"
      )
      .filter((m) => new Date(m.date).getTime() >= Date.now())
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (future.length) return future[0];
  }
  return null;
}

function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  const target = iso ? new Date(iso).getTime() : 0;
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "TBD";
    export default function Dashbord() {
      const navigate = useNavigate();
    
      // auth hook MUST be at the top level of the component
      const { user } = useAuth();
    
      const guestNameFromStorage = localStorage.getItem("guestName") || "Guest";
    
      const displayName = user
        ? (user.first_name || user.last_name
            ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
            : user.email)
        : guestNameFromStorage;
    
      const [liveMatches, setLiveMatches] = useState([]); // ARRAY
      const [nextMatch, setNextMatch] = useState(null);
      const [loading, setLoading] = useState(true);
    
      const hasLive = liveMatches.length > 0;
      const { d, h, m, s } = useCountdown(nextMatch?.date);
    
      useEffect(() => {
        let mounted = true;
    
        const load = async () => {
          setLoading(true);
          const lm = await fetchLiveMatch(); // returns []
          if (!mounted) return;
    
          if (lm && lm.length > 0) {
            setLiveMatches(lm);
            setNextMatch(null);
          } else {
            setLiveMatches([]);
            const up = await fetchUpcomingMatch();
            if (!mounted) return;
            setNextMatch(up);
          }
          setLoading(false);
        };
    
        // initial load
        load();
    
        // 15s polling
        const t = setInterval(load, 15000);
    
        return () => {
          mounted = false;
          clearInterval(t);
        };
      }, []);
    
  return (
    <div className="dashboard-page">
      <TopNav name={displayName} hasLive={hasLive} />

      <main className="sl-main">
        <h1 className="sl-welcome">Welcome back, {displayName}!</h1>
        <p className="sl-subtitle">Saint Leo Lions Tennis Team Dashboard</p>

        {loading ? (
  <div className="sl-card sl-skeleton">Loading…</div>
) : hasLive ? (
  <div className="sl-live-stack">
    {/* Optional header with count */}
    <div className="sl-live-count">
      {liveMatches.length} LIVE MATCH
      {liveMatches.length > 1 ? "ES" : ""} IN PROGRESS
    </div>

    {liveMatches.map((m) => (
      <div className="sl-live-banner" key={m.id}>
        <div className="sl-live-left">
          <span className="sl-live-dot" aria-hidden>
            •
          </span>
          <span className="sl-live-text">Live match in progress</span>
          <div className="sl-live-title">
            {m.opponent ? `Lions vs ${m.opponent}` : "Live Match"}
          </div>
          {m.location && (
            <div className="sl-live-loc">
              📍 {m.location}
            </div>
          )}
        </div>
        <div className="sl-live-right">
          <button
            className="sl-view-btn"
            onClick={() => navigate("/livescore")}
          >
            View Live Scores
          </button>
        </div>
      </div>
    ))}
  </div>
) : (
          <div className="sl-next-pretty">
            <div className="sl-next-left">
              <div className="sl-next-title">No live matches right now</div>
              <div className="sl-next-sub">Next match is in:</div>

              {nextMatch?.date ? (
                <div className="sl-countdown">
                  <div className="sl-unit">
                    <span>{String(d).padStart(2, "0")}</span>
                    <small>days</small>
                  </div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit">
                    <span>{String(h).padStart(2, "0")}</span>
                    <small>hrs</small>
                  </div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit">
                    <span>{String(m).padStart(2, "0")}</span>
                    <small>min</small>
                  </div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit">
                    <span>{String(s).padStart(2, "0")}</span>
                    <small>sec</small>
                  </div>
                </div>
              ) : (
                <div className="sl-next-fallback">TBD — check schedule</div>
              )}

              <div className="sl-next-meta">
                {nextMatch?.opponent
                  ? `Lions vs ${nextMatch.opponent}`
                  : "Opponent TBA"}
                {nextMatch?.location ? ` • ${nextMatch.location}` : ""}
              </div>
              <div className="sl-next-date">{fmtDate(nextMatch?.date)}</div>
            </div>

            <div className="sl-next-right">
              <Link className="sl-view-btn" to="/schedule">
                View Schedule
              </Link>
            </div>
          </div>
        )}

        {/* Regular cards */}
        <section className="sl-cards">
          <Link to="/schedule" className="sl-card">
            <div className="sl-cta-title">Schedule</div>
            <div className="sl-cta-sub">Upcoming & past matches</div>
          </Link>

          {!hasLive && (
            <Link to="/livescore" className="sl-card sl-cta">
              <div className="sl-cta-title">Scores</div>
              <div className="sl-cta-sub">Open scoreboard</div>
            </Link>
          )}

          <Link to="/admin" className="sl-card">
            <div className="sl-cta-title">Admin Panel</div>
            <div className="sl-cta-sub">Manage matches & scores</div>
          </Link>
        </section>

        {/* Big donate section at the very bottom */}
        <section className="sl-donate-wide">
          <div className="sl-donate-content">
            <h2 className="sl-donate-title">Support Saint Leo Tennis</h2>
            <p className="sl-donate-text">
              Your donation helps our team with travel, equipment, and creating
              the best possible experience for our student-athletes.
            </p>
            <p className="sl-donate-text">
              Every contribution, big or small, makes a real impact on our
              season.
            </p>
            <a
              href="https://ets.rocks/4o1T9nO"
              target="_blank"
              rel="noreferrer"
              className="sl-donate-button"
            >
              Donate Now
            </a>
          </div>

        </section>
      </main>
      <div className="App">
  {/* your routes or pages */}
  <Footer />
</div>
    </div>
  );
}
