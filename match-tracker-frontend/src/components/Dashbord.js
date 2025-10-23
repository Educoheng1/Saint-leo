// src/pages/Dashbord.js
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles.css";

const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  process.env.VITE_API_BASE ||
  "http://127.0.0.1:8000";

const TOKEN = localStorage.getItem("token") || "";

const headers = {
  "Content-Type": "application/json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function fetchJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

function looksLive(m) {
  const st = String(m?.status ?? "").toLowerCase();
  const started = Boolean(m?.started);
  return (st === "live" || st === "in_progress" || st === "in-progress" || started) && st !== "completed";
}

async function fetchLiveMatch() {
  // Try dedicated endpoints first
  for (const url of [
    `${API_BASE}/schedule?status=live`,
    `${API_BASE}/schedule?status=Live`,
  ]) {
    const d = await fetchJSON(url);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : [d];
    const found = arr.find(looksLive) || (arr.length === 1 && looksLive(arr[0]) ? arr[0] : null);
    if (found) {
      const full = await fetchJSON(`${API_BASE}/schedule/${found.id}`); // hydrate details
      return full || found;
    }
  }
  // Fallback: list all and filter
  const all = await fetchJSON(`${API_BASE}/schedule`);
  if (Array.isArray(all)) {
    const lives = all.filter(looksLive);
    if (lives.length) {
      lives.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const cand = lives[0];
      const full = await fetchJSON(`${API_BASE}/schedule/${cand.id}`);
      return full || cand;
    }
  }
  return null;
}

async function fetchUpcomingMatch() {
  // Prefer scheduled; otherwise pick nearest future non-completed
  for (const url of [
    `${API_BASE}/schedule?status=scheduled`,
    `${API_BASE}/schedule/upcoming`,
    `${API_BASE}/schedule`,
    
  ]) {
    const d = await fetchJSON(url);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : (d?.items || d?.results || (d ? [d] : []));
    const future = arr
      .filter(m => m?.date && String(m?.status || "").toLowerCase() !== "completed")
      .filter(m => new Date(m.date).getTime() >= Date.now())
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
  iso ? new Date(iso).toLocaleString(undefined, { weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }) : "TBD";

function TopNav({ name, hasLive }) {
  return (
    <header className="sl-topnav">
      <div className="sl-brand">
        <img src="/saint-leo-logo.png" alt="Saint Leo" />
        <div className="sl-brand-text">
          <span className="sl-brand-title">Saint Leo</span>
          <span className="sl-brand-sub">Tennis</span>
        </div>
      </div>

      <nav className="sl-navlinks">
        <Link to="/dashboard" className="sl-navlink">Dashboard</Link>
        <Link to="/schedule" className="sl-navlink">Schedule</Link>
        <Link to="/players" className="sl-navlink">Roster</Link>
        {hasLive && <Link to="/livescore" className="sl-navlink sl-navlink-accent">Live Scores</Link>}
        <Link to="/admin" className="sl-navlink">Admin Panel</Link>
      </nav>

      <div className="sl-userbox">
        <span className="sl-username">{name}</span>
        <button className="sl-logout" onClick={() => { localStorage.clear(); }}>Logout</button>
      </div>
    </header>
  );
}

export default function Dashbord() {
  const navigate = useNavigate();
  const guestName = localStorage.getItem("guestName") || "Guest";

  const [liveMatch, setLiveMatch] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const hasLive = !!liveMatch;
  const { d, h, m, s } = useCountdown(nextMatch?.date);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const lm = await fetchLiveMatch();
      if (!mounted) return;
      if (lm) {
        setLiveMatch(lm);
      } else {
        const up = await fetchUpcomingMatch();
        if (!mounted) return;
        setNextMatch(up);
      }
      setLoading(false);
    })();

    const t = setInterval(async () => {
      const lm = await fetchLiveMatch();
      if (!mounted) return;
      setLiveMatch(lm);
      if (!lm) setNextMatch(await fetchUpcomingMatch());
    }, 15000);

    return () => { mounted = false; clearInterval(t); };
  }, []);

  return (
    <div className="dashboard-page">
      <TopNav name={guestName} hasLive={hasLive} />

      <main className="sl-main">
        <h1 className="sl-welcome">Welcome back, {guestName}!</h1>
        <p className="sl-subtitle">Saint Leo Lions Tennis Team Dashboard</p>

        {loading ? (
          <div className="sl-card sl-skeleton">Loading…</div>
        ) : hasLive ? (
          <div className="sl-live-banner">
            <div className="sl-live-left">
              <span className="sl-live-dot" aria-hidden>•</span>
              <span className="sl-live-text">Live match in progress</span>
              <div className="sl-live-title">
                {liveMatch?.opponent ? `Lions vs ${liveMatch.opponent}` : "Live Match"}
              </div>
              {liveMatch?.location && <div className="sl-live-loc">📍 {liveMatch.location}</div>}
            </div>
            <div className="sl-live-right">
              <button className="sl-view-btn" onClick={() => navigate("/livescore")}>
                View Live Scores
              </button>
            </div>
          </div>
        ) : (
          <div className="sl-next-pretty">
            <div className="sl-next-left">
              <div className="sl-next-title">No live matches right now</div>
              <div className="sl-next-sub">Next match is in:</div>

              {nextMatch?.date ? (
                <div className="sl-countdown">
                  <div className="sl-unit"><span>{String(d).padStart(2,"0")}</span><small>days</small></div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit"><span>{String(h).padStart(2,"0")}</span><small>hrs</small></div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit"><span>{String(m).padStart(2,"0")}</span><small>min</small></div>
                  <div className="sl-colon">:</div>
                  <div className="sl-unit"><span>{String(s).padStart(2,"0")}</span><small>sec</small></div>
                </div>
              ) : (
                <div className="sl-next-fallback">TBD — check schedule</div>
              )}

              <div className="sl-next-meta">
                {nextMatch?.opponent ? `Lions vs ${nextMatch.opponent}` : "Opponent TBA"}
                {nextMatch?.location ? ` • ${nextMatch.location}` : ""}
              </div>
              <div className="sl-next-date">{fmtDate(nextMatch?.date)}</div>
            </div>

            <div className="sl-next-right">
              <Link className="sl-view-btn" to="/schedule">View Schedule</Link>
            </div>
          </div>
        )}

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
      </main>
    </div>
  );
}
