// src/pages/Schedule.js
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles.css";
import { useAdmin } from "../AdminContext";
import BackButton from "./BackButton";
import API_BASE_URL from "../config";

// ---------- Top Nav (same style as Dashboard)
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
        <Link to="/players" className="sl-navlink">Roster</Link>
        <Link to="/schedule" className="sl-navlink sl-navlink-accent">Schedule</Link>
        <Link to="/livescore" className="sl-navlink">{hasLive ? "Live Scores" : "Scores"}</Link>
        <Link to="/admin" className="sl-navlink">Admin Panel</Link>
      </nav>

      <div className="sl-userbox">
        <span className="sl-username">{name}</span>
        <button
          className="sl-logout"
          onClick={() => { localStorage.clear(); }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

// ---------- utils
const normGender = (g) => {
  const s = String(g || "").toLowerCase();
  if (["m", "male", "men", "man"].includes(s)) return "men";
  if (["f", "female", "women", "woman"].includes(s)) return "women";
  return "unknown";
};
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

function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  const target = iso ? new Date(iso).getTime() : 0;
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

// ---------- API helpers
async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function getMatchesByGender(gender) {
  const urls = [
    `${API_BASE_URL}/schedule?gender=${gender}`,
    `${API_BASE_URL}/schedule`,
  
  ];
  for (const u of urls) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : d.items || d.results || [d];
    const filtered = arr.filter((m) => normGender(m.gender) === gender);
    if (u.includes("?gender=")) return filtered;
    if (filtered.length || arr.length) return filtered.length ? filtered : arr;
  }
  return [];
}

async function getRosterByGender(gender) {
  const urls = [
    `${API_BASE_URL}/players?gender=${gender}`,
    `${API_BASE_URL}/roster?gender=${gender}`,
    `${API_BASE_URL}/players`,
    `${API_BASE_URL}/roster`,
  ];
  for (const u of urls) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : d.items || d.results || [d];
    const normalized = arr.map((p) => ({
      id: p.id ?? `${p.first_name || ""}-${p.last_name || ""}-${p.email || ""}`,
      name:
        p.full_name ||
        p.name ||
        [p.first_name, p.last_name].filter(Boolean).join(" ") ||
        "Unnamed",
      gender: normGender(p.gender),
      year: p.year || p.class || null,
      hand: p.hand || null,
    }));
    const filtered = normalized.filter((p) => p.gender === gender);
    if (u.includes("?gender=")) return filtered;
    if (filtered.length || normalized.length) return filtered.length ? filtered : normalized;
  }
  return [];
}

// ---------- UI bits
function MatchCard({ match, isAdmin, onDelete }) {
  const navigate = useNavigate();
  return (
    <div className="sl-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#174d2a" }}>
        <img src="/saint-leo-logo.png" alt="Saint Leo" style={{ height: 22 }} />
        <span>{`Saint Leo vs ${match.opponent || "TBD"}`}</span>
      </div>
      <div style={{ color: "#4f6475", marginTop: 4 }}>
        {fmtDate(match.date)} {match.location ? `• ${match.location}` : ""}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {String(match.status).toLowerCase() === "completed" && (
          <button className="sl-view-btn" onClick={() => navigate(`/boxscore/${match.id}`)}>
            View Box Score
          </button>
        )}
        {String(match.status).toLowerCase() === "live" && (
          <Link className="sl-view-btn" to="/livescore">Go to Live Score</Link>
        )}
        {isAdmin && (
          <button
            className="sl-logout"
            onClick={() => onDelete?.(match.id)}
            style={{ borderColor: "#f3c1c1" }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function RosterPanel({ roster }) {
  if (!roster?.length) return (
    <div className="sl-card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#174d2a" }}>Roster</div>
      <div style={{ color: "#4f6475" }}>No players found.</div>
    </div>
  );
  return (
    <div className="sl-card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 10, color: "#174d2a" }}>Roster</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
        {roster.map((p) => (
          <div key={p.id} style={{ border: "1px solid #e7f0e7", borderRadius: 10, padding: 8 }}>
            <div style={{ fontWeight: 600, color: "#123" }}>{p.name}</div>
            <div style={{ color: "#5c6b62", fontSize: 12 }}>
              {p.year ? `Year: ${p.year}` : ""} {p.hand ? `• ${p.hand}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Component
export default function Schedule() {
  const { isAdmin } = useAdmin();
  const guestName = localStorage.getItem("guestName") || (isAdmin ? "Admin" : "Guest");
  const [tab, setTab] = useState("men"); // 'men' | 'women'
  const [matches, setMatches] = useState([]);
  const [roster, setRoster] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newMatch, setNewMatch] = useState({ date: "", opponent: "", location: "" });
  const [loading, setLoading] = useState(true);

  // refresh on tab change
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [m, r] = await Promise.all([getMatchesByGender(tab), getRosterByGender(tab)]);
      if (!mounted) return;
      setMatches(m || []);
      setRoster(r || []);
      setLoading(false);
    })();
    const t = setInterval(async () => {
      const m = await getMatchesByGender(tab);
      setMatches(m || []);
    }, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, [tab]);

  // derive live/next/upcoming/past
  const now = Date.now();
  const sorted = useMemo(
    () => [...matches].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [matches]
  );
  const liveMatch = sorted.find((m) => String(m.status).toLowerCase() === "live");
  const nextMatch = sorted.find(
    (m) => String(m.status).toLowerCase() === "scheduled" && new Date(m.date).getTime() > now
  );
  const upcoming = sorted.filter(
    (m) => String(m.status).toLowerCase() === "scheduled" && m !== nextMatch
  );
  const past = [...sorted]
    .filter((m) => String(m.status).toLowerCase() === "completed")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const { days, hours, minutes, seconds } = useCountdown(nextMatch?.date);
  const hasLive = !!liveMatch;

  // actions
  const handleDeleteMatch = async (id) => {
    if (!window.confirm("Delete this match?")) return;
    const res = await fetch(`${API_BASE_URL}/schedule/${id}`, { method: "DELETE" });
    if (res.ok) setMatches((prev) => prev.filter((m) => m.id !== id));
    else alert("Failed to delete match");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        date: new Date(newMatch.date).toISOString().replace("Z", ""),
        gender: tab,
        opponent: newMatch.opponent,
        location: newMatch.location,
        status: "scheduled",
        match_number: Date.now(),
        winner: null,
      };
      const response = await fetch(`${API_BASE_URL}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await response.text());
      setShowForm(false);
      setNewMatch({ date: "", opponent: "", location: "" });
      const m = await getMatchesByGender(tab);
      setMatches(m || []);
    } catch (err) {
      console.error(err);
      alert("Failed to create match");
    }
  };

  return (
    <>
      <TopNav name={guestName} hasLive={hasLive} />

      <div className="sl-main" style={{ maxWidth: 1100, margin: "16px auto", padding: "0 16px" }}>
      <button className="sl-back" onClick={() => window.history.back()} aria-label="Go back">← Back</button>
        <h1 className="sl-welcome">Schedule</h1>
        <p className="sl-subtitle">Browse matches and rosters by team</p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            className={`sl-logout ${tab === "men" ? "sl-view-btn" : ""}`}
            onClick={() => setTab("men")}
            style={{ minWidth: 92 }}
          >
            Men
          </button>
          <button
            className={`sl-logout ${tab === "women" ? "sl-view-btn" : ""}`}
            onClick={() => setTab("women")}
            style={{ minWidth: 92 }}
          >
            Women
          </button>
          {isAdmin && (
            <button className="sl-navlink" onClick={() => setShowForm((s) => !s)} style={{ marginLeft: "auto" }}>
              {showForm ? "Cancel" : "Add Match"}
            </button>
          )}
        </div>

        {/* Admin add form */}
        {isAdmin && showForm && (
          <form onSubmit={handleSubmit} className="sl-card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <input type="datetime-local" required value={newMatch.date} onChange={(e) => setNewMatch((p) => ({ ...p, date: e.target.value }))} />
              <input placeholder="Opponent" required value={newMatch.opponent} onChange={(e) => setNewMatch((p) => ({ ...p, opponent: e.target.value }))} />
              <input placeholder="Location" required value={newMatch.location} onChange={(e) => setNewMatch((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div style={{ marginTop: 10 }}>
              <button type="submit" className="sl-view-btn">Create Match ({tab})</button>
            </div>
          </form>
        )}

        {/* Live or Next */}
        {loading ? (
          <div className="sl-card sl-skeleton">Loading…</div>
        ) : liveMatch ? (
          <div className="sl-live-banner">
            <div className="sl-live-left">
              <span className="sl-live-dot">•</span>
              <span className="sl-live-text">Live now — {tab === "men" ? "Men" : "Women"}</span>
              <div className="sl-live-title">{`Lions vs ${liveMatch.opponent || "TBD"}`}</div>
              {liveMatch.location && <div className="sl-live-loc">📍 {liveMatch.location}</div>}
            </div>
            <div className="sl-live-right">
              <Link className="sl-view-btn" to="/livescore">Go to Live Score</Link>
            </div>
          </div>
        ) : nextMatch ? (
          <div className="sl-next-pretty">
            <div className="sl-next-left">
              <div className="sl-next-title">No live matches right now</div>
              <div className="sl-next-sub">Next match is in:</div>
              <div className="sl-countdown">
                <div className="sl-unit"><span>{String(days).padStart(2, "0")}</span><small>days</small></div>
                <div className="sl-colon">:</div>
                <div className="sl-unit"><span>{String(hours).padStart(2, "0")}</span><small>hrs</small></div>
                <div className="sl-colon">:</div>
                <div className="sl-unit"><span>{String(minutes).padStart(2, "0")}</span><small>min</small></div>
                <div className="sl-colon">:</div>
                <div className="sl-unit"><span>{String(seconds).padStart(2, "0")}</span><small>sec</small></div>
              </div>
              <div className="sl-next-meta">
                {`Lions vs ${nextMatch.opponent || "TBD"}`} {nextMatch.location ? `• ${nextMatch.location}` : ""}
              </div>
              <div className="sl-next-date">{fmtDate(nextMatch.date)}</div>
            </div>
            <div className="sl-next-right">
              <Link className="sl-view-btn" to="/schedule">View Full Schedule</Link>
            </div>
          </div>
        ) : (
          <div className="sl-card sl-empty">No matches scheduled yet.</div>
        )}

        {/* Grid: left schedule lists, right roster */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div>
            <div className="sl-card" style={{ marginBottom: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, color: "#174d2a", marginBottom: 8 }}>Upcoming Matches</div>
              {upcoming.length ? (
                upcoming.map((m) => (
                  <MatchCard key={m.id} match={m} isAdmin={isAdmin} onDelete={handleDeleteMatch} />
                ))
              ) : (
                <div style={{ color: "#4f6475" }}>No upcoming matches.</div>
              )}
            </div>

            <div className="sl-card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, color: "#174d2a", marginBottom: 8 }}>Past Matches</div>
              {past.length ? (
                past.map((m) => (
                  <MatchCard key={m.id} match={m} isAdmin={isAdmin} onDelete={handleDeleteMatch} />
                ))
              ) : (
                <div style={{ color: "#4f6475" }}>No past matches.</div>
              )}
            </div>
          </div>

          <RosterPanel roster={roster} />
        </div>
      </div>
    </>
  );
}
