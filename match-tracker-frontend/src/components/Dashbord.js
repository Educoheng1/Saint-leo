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
    st !== "completed" &&
    st !== "finished"
  );
}

async function fetchLiveMatchesByGender(gender) {
  // Prefer dedicated endpoint
  for (const url of [
    `${API_BASE_URL}/schedule?status=live&gender=${gender}`,
    `${API_BASE_URL}/schedule?status=in_progress&gender=${gender}`,
    `${API_BASE_URL}/schedule?gender=${gender}`,
  ]) {
    const d = await fetchJSON(url);
    if (!d) continue;

    const arr = Array.isArray(d) ? d : d?.items || d?.results || (d ? [d] : []);
    const lives = arr.filter((m) => looksLive(m));

    if (lives.length) {
      // hydrate each match with full details if possible
      const full = [];
      for (const m of lives) {
        const details = m?.id ? await fetchJSON(`${API_BASE_URL}/schedule/${m.id}`) : null;
        full.push(details || m);
      }
      return full;
    }
  }

  // Fallback: list all and filter by gender if present
  const all = await fetchJSON(`${API_BASE_URL}/schedule`);
  if (Array.isArray(all)) {
    const lives = all
      .filter(looksLive)
      .filter((m) => {
        const g = String(m?.gender || m?.tab || "").toLowerCase();
        return !g ? true : g === gender;
      });

    lives.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return lives;
  }

  return [];
}

async function fetchUpcomingMatch(gender) {
  for (const url of [
    `${API_BASE_URL}/schedule?status=scheduled&gender=${gender}`,
    `${API_BASE_URL}/schedule/upcoming?gender=${gender}`,
    `${API_BASE_URL}/schedule?gender=${gender}`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(url);
    if (!d) continue;

    const arr = Array.isArray(d) ? d : d?.items || d?.results || (d ? [d] : []);

    const future = arr
      .filter((m) => {
        // optional gender filtering if endpoint doesn’t apply it
        if (url.endsWith("/schedule")) {
          const g = String(m?.gender || m?.tab || "").toLowerCase();
          if (g && g !== gender) return false;
        }
        return m?.date && new Date(m.date).getTime() >= Date.now();
      })
      .filter((m) => {
        const st = String(m?.status || "").toLowerCase();
        return st !== "completed" && st !== "finished";
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (future.length) return future[0];
  }

  return null;
}

async function fetchLastCompletedMatch(gender) {
  for (const url of [
    `${API_BASE_URL}/schedule?status=completed&gender=${gender}`,
    `${API_BASE_URL}/schedule?status=finished&gender=${gender}`,
    `${API_BASE_URL}/schedule/completed?gender=${gender}`,
    `${API_BASE_URL}/schedule?gender=${gender}`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(url);
    if (!d) continue;

    const arr = Array.isArray(d) ? d : d?.items || d?.results || (d ? [d] : []);

    const completed = arr
      .filter((m) => {
        // optional gender filtering if endpoint doesn’t apply it
        if (url.endsWith("/schedule")) {
          const g = String(m?.gender || m?.tab || "").toLowerCase();
          if (g && g !== gender) return false;
        }
        const st = String(m?.status || "").toLowerCase();
        return st === "completed" || st === "finished";
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (completed.length) {
      const m = completed[0];
      const details = m?.id ? await fetchJSON(`${API_BASE_URL}/schedule/${m.id}`) : null;
      return details || m;
    }
  }

  // final fallback: most recent past match for that gender
  const all = await fetchJSON(`${API_BASE_URL}/schedule`);
  if (Array.isArray(all)) {
    const past = all
      .filter((m) => {
        const g = String(m?.gender || m?.tab || "").toLowerCase();
        if (g && g !== gender) return false;
        return m?.date && new Date(m.date).getTime() < Date.now();
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return past[0] || null;
  }

  return null;
}

function getFinalScoreText(m) {
  if (!m) return "Final score unavailable";

  // ✅ matches.team_score is JSON: { team: X, opponent: Y }
  if (m.team_score && typeof m.team_score === "object") {
    const t = m.team_score.team;
    const o = m.team_score.opponent;
    if (t !== undefined && o !== undefined) return `Final: ${t} - ${o}`;
  }

  // fallback if you ever store it as string
  if (typeof m.team_score === "string" && m.team_score.trim()) {
    return `Final: ${m.team_score}`;
  }

  return "Final score unavailable";
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

function NextMatchCard({ nextMatch, countdown }) {
  const { d, h, m, s } = countdown || { d: 0, h: 0, m: 0, s: 0 };

  return (
    <div className="sl-next-pretty">
      <div className="sl-next-left">
        <div className="sl-next-title">Next match</div>

        {nextMatch?.date ? (
          <>
            <div className="sl-next-sub">Starts in:</div>

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

            <div className="sl-next-meta">
              {nextMatch?.opponent ? `Lions vs ${nextMatch.opponent}` : "Opponent TBA"}
              {nextMatch?.location ? ` • ${nextMatch.location}` : ""}
            </div>

            <div className="sl-next-date">{fmtDate(nextMatch?.date)}</div>
          </>
        ) : (
          <div className="sl-next-fallback">No upcoming match scheduled</div>
        )}
      </div>

      <div className="sl-next-actions">
  <Link className="sl-schedule-btn" to="/schedule">
    View Schedule
  </Link>
</div>
    </div>
  );
}
function LastMatchCard({ lastMatch, genderLabel }) {
  if (!lastMatch) {
    return (
      <div className="lastResultCard neutral">
        <div className="lrcTitle">Last match</div>
        <div className="lrcScore">
          <span className="pending">No completed match yet</span>
        </div>
      </div>
    );
  }

  const score =
  lastMatch.team_score && typeof lastMatch.team_score === "object"
    ? `${lastMatch.team_score.team}-${lastMatch.team_score.opponent}`
    : lastMatch.team_score;
  const didWin = String(lastMatch.winner || "").toLowerCase() === "team";

  const themeClass = didWin ? "win" : "loss";

  return (
    <div className={`lastResultCard ${themeClass}`}>
      <div className="lrcTop">
        <div className="lrcTitleRow">
          <div className="lrcTitle">Last match</div>
          <div className="lrcPill">
            {didWin ? "Win 🏆" : "Loss"}
            {genderLabel ? ` • ${genderLabel}` : ""}
            {lastMatch.location ? ` • ${lastMatch.location}` : ""}
          </div>
        </div>

        <div className="lrcSub">
  Saint Leo vs {lastMatch.opponent}
  <span className="dot">•</span>
  {fmtDate(lastMatch.date)}
</div>
</div>

<div className="lrcScoreRow">
  <div className="lrcTeamBadge home">Saint Leo</div>

  <div className="lrcScore">
    {score ? (
      score.split("-").map((n, i) => (
        <span key={i} className="num">
          {n}
          {i === 0 && <span className="dash">–</span>}
        </span>
      ))
    ) : (
      <span className="pending">Score pending</span>
    )}
  </div>

  <div className="lrcTeamBadge away">
    {lastMatch.opponent}
  </div>
</div>

      <div className="lrcActions">
        <Link className="lrcBtn" to={`/boxscore/${lastMatch.id}`}>
          View Box Score →
        </Link>
      </div>
    </div>
  );
}

export default function Dashbord() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const guestNameFromStorage = localStorage.getItem("guestName") || "Guest";

  const displayName = user
    ? user.first_name || user.last_name
      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
      : user.email
    : guestNameFromStorage;

  const [loading, setLoading] = useState(true);

  const [liveMen, setLiveMen] = useState([]);
  const [liveWomen, setLiveWomen] = useState([]);

  const [nextMatchMen, setNextMatchMen] = useState(null);
  const [lastMatchMen, setLastMatchMen] = useState(null);

  const [nextMatchWomen, setNextMatchWomen] = useState(null);
  const [lastMatchWomen, setLastMatchWomen] = useState(null);

  const hasLive = (liveMen?.length || 0) + (liveWomen?.length || 0) > 0;

  const menCountdown = useCountdown(nextMatchMen?.date);
  const womenCountdown = useCountdown(nextMatchWomen?.date);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      const [
        lmMen,
        lmWomen,
        upMen,
        lastMen,
        upWomen,
        lastWomen,
      ] = await Promise.all([
        fetchLiveMatchesByGender("men"),
        fetchLiveMatchesByGender("women"),
        fetchUpcomingMatch("men"),
        fetchLastCompletedMatch("men"),
        fetchUpcomingMatch("women"),
        fetchLastCompletedMatch("women"),
      ]);

      if (!mounted) return;

      setLiveMen(lmMen || []);
      setLiveWomen(lmWomen || []);

      setNextMatchMen(upMen);
      setLastMatchMen(lastMen);

      setNextMatchWomen(upWomen);
      setLastMatchWomen(lastWomen);

      setLoading(false);
    };

    load();
    const t = setInterval(load, 15000);

    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const renderLiveBanners = (title, matches) => {
    if (!matches?.length) return null;

    return (
      <div className="sl-live-stack">
        <div className="sl-live-count">
          {matches.length} LIVE MATCH{matches.length > 1 ? "ES" : ""} IN PROGRESS - {title}
        </div>

        {matches.map((m) => (
          <div className="sl-live-banner" key={m.id}>
            <div className="sl-live-left">
              <span className="sl-live-dot" aria-hidden>
                •
              </span>
              <span className="sl-live-text">Live match in progress</span>
              <div className="sl-live-title">
                {m.opponent ? `Lions vs ${m.opponent}` : "Live Match"}
              </div>
              {m.location && <div className="sl-live-loc">📍 {m.location}</div>}
            </div>
            <div className="sl-live-right">
              <button className="sl-view-btn" onClick={() => navigate("/livescore")}>
                View Live Scores
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="dashboard-page">
      <TopNav name={displayName} hasLive={hasLive} />

      <main className="sl-main">
        <h1 className="sl-welcome">Welcome back, {displayName}!</h1>
        <p className="sl-subtitle">Saint Leo Lions Tennis Team Dashboard</p>

        {loading ? (
          <div className="sl-card sl-skeleton">Loading…</div>
        ) : (
          <>
            {renderLiveBanners("Men", liveMen)}
            {renderLiveBanners("Women", liveWomen)}

            <h3 className="dash-section-title">Men</h3>
            <div className="dash-two-cards">
              <NextMatchCard nextMatch={nextMatchMen} countdown={menCountdown} />
              <LastMatchCard lastMatch={lastMatchMen} genderLabel="Men" />
            </div>

            <h3 className="dash-section-title" style={{ marginTop: 24 }}>
              Women
            </h3>
            <div className="dash-two-cards">
              <NextMatchCard nextMatch={nextMatchWomen} countdown={womenCountdown} />
              <LastMatchCard lastMatch={lastMatchWomen} genderLabel="Women" />
            </div>
          </>
        )}

        <section className="sl-donate-wide">
          <div className="sl-donate-content">
            <h2 className="sl-donate-title">Support Saint Leo Tennis</h2>
            <p className="sl-donate-text">
              Your donation helps our team with travel, equipment, and creating the best possible
              experience for our student-athletes.
            </p>
            <p className="sl-donate-text">
              Every contribution, big or small, makes a real impact on our season.
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
        <Footer />
      </div>
    </div>
  );
}
