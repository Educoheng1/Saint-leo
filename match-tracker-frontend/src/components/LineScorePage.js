// src/components/LineScorePage.js
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import API_BASE_URL from "../config";
import "../styles.css";
import Footer from "./Footer";
import TopNav from "./Topnav";
import { useAuth } from "../AuthContext";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ResponsiveContainer,
    Legend,
  } from "recharts";
  import { useNavigate } from "react-router-dom";



const normalizeSets = (sets = [], N = 3) => {
    const s = (sets || []).map((x) => {
      if (Array.isArray(x)) return { team: Number(x[0] ?? 0), opp: Number(x[1] ?? 0) };
      return {
        team: Number(x.team ?? x.a ?? x.team_score ?? 0),
        opp: Number(x.opp ?? x.b ?? x.opp_score ?? 0),
        super: !!x.super,
      };
    });
    while (s.length < N) s.push({ team: 0, opp: 0 });
    return s.slice(0, N);
  };
  
  const gameLabel = (cg) => {
    if (!Array.isArray(cg) || cg.length < 2) return "—";
    return `${cg[0] ?? 0}–${cg[1] ?? 0}`;
  };
  
  function ServeDot({ side }) {
    if (!side) return null;
    return (
      <span
        className={`serve-dot ${side === "team" ? "serve-team" : "serve-opp"}`}
        title={`${side} serving`}
        style={{ marginRight: 8 }}
      />
    );
  }
  function buildCumulativeSeries(line) {
    const setCols = normalizeSets(line?.sets, 3);
  
    let teamTotal = 0;
    let oppTotal = 0;
  
    const points = setCols.map((s, idx) => {
      teamTotal += s.team ?? 0;
      oppTotal += s.opp ?? 0;
  
      return {
        label: `Set ${idx + 1}`,
        lions: teamTotal,
        opp: oppTotal,
      };
    });
  
    // Optional: add a live "Now" point using current_game
    const status = String(line?.status ?? "").toLowerCase().trim();
    const cg = Array.isArray(line?.current_game) ? line.current_game : null;
    const hasLiveGame = cg && cg.length >= 2 && (Number(cg[0]) || Number(cg[1]));
  
    if (status === "live" && hasLiveGame) {
      points.push({
        label: "Now",
        lions: teamTotal + (Number(cg[0]) || 0),
        opp: oppTotal + (Number(cg[1]) || 0),
      });
    }
  
    return points;
  }
  
  
  function StatusChip({ status }) {
    const st = String(status || "").toLowerCase();
    if (st === "live") return <span className="sl-chip sl-chip-live">LIVE</span>;
    if (st === "completed") return <span className="sl-chip">COMPLETED</span>;
    if (st === "scheduled") return <span className="sl-chip">SCHEDULED</span>;
    return <span className="sl-chip">{String(status || "STATUS").toUpperCase()}</span>;
  }
  
  function CumulativeGamesChart({ line }) {
    const data = buildCumulativeSeries(line);
  
    return (
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line
  type="monotone"
  dataKey="lions"
  stroke="#006341"
  strokeWidth={2}
  dot
  name="Lions"
/>

<Line
  type="monotone"
  dataKey="opp"
  stroke="#c1121f"
  strokeWidth={2}
  dot
  name="Opp"
/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  
export default function LineScorePage() {
  const { matchId, lineId } = useParams();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [line, setLine] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [momentum, setMomentum] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/scores/${lineId}`);
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();

        if (!mounted) return;
        setLine(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadComments() {
      try {
        const r = await fetch(`${API_BASE_URL}/scores/${lineId}/comments`);
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        setComments(data);
      } catch (e) {
        console.error(e);
      }
    }

    async function loadMomentum() {
      try {
        const r = await fetch(`${API_BASE_URL}/scores/${lineId}/momentum`);
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        setMomentum(data);
      } catch (e) {
        console.error(e);
      }
    }

    load();
    loadComments();
    // loadMomentum();
    
    return () => {
      mounted = false;
    };
  }, [lineId]);

  async function handleCommentSubmit(e) {
    e.preventDefault();
  
    if (!token) {
      setShowAuthModal(true);
      return;
    }
  
    const r = await fetch(`${API_BASE_URL}/scores/${lineId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text: newComment }),
    });
  
    if (r.status === 401) {
      setShowAuthModal(true);
      return;
    }
  
    if (!r.ok) throw new Error(await r.text());
  
    const newCommentData = await r.json();
    setComments((prev) => [newCommentData, ...prev]);
    setNewComment("");
  }
  

  if (loading) return <main className="sl-main">Loading…</main>;
  if (!line) return <main className="sl-main">Not found.</main>;

  return (
    <>
        <TopNav />
    <main className="sl-main">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="sl-welcome">Line score</h1>
    
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link to="/livescore" className="back-button">
    ← Back
  </Link>

</div>
      </div>

      <section className="sl-card" style={{ marginTop: 16 }}>
        <h2>Score</h2>
        {/* Render however you want; this just shows raw data */}
        {(() => {
  const setCols = normalizeSets(line.sets, 3);
  const cs = String(line.current_serve);
  const serveSide = cs === 0 ? "team" : cs === 1 ? "opp" : null;

  // names (use what exists; fallback safe)
  const mt = String(line.match_type || line.type || "").toLowerCase();
  const isDoubles = mt === "doubles";

  const teamNames = isDoubles
    ? [line.player1, line.player2].filter(Boolean).join(" & ")
    : (line.player1 || line.teamA?.player_name || "Lions");

  const oppNames = isDoubles
    ? [line.opponent1, line.opponent2].filter(Boolean).join(" & ")
    : (line.opponent1 || line.teamB?.player_name || "Opp");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            {isDoubles ? "Doubles" : "Singles"}
          </div>
          <StatusChip status={line.status} />
        </div>

        <div style={{ fontSize: 14, opacity: 0.8 }}>
          Game: {gameLabel(line.current_game)}
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {/* Team row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <ServeDot side={serveSide === "team" ? "team" : null} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16 }}>{teamNames}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>Lions</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            {setCols.map((s, i) => (
              <div key={i} style={{ width: 22, textAlign: "right" }}>
                {s.team ?? 0}
              </div>
            ))}
          </div>
        </div>

        {/* Opp row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <ServeDot side={serveSide === "opp" ? "opp" : null} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16 }}>{oppNames}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>Opp</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            {setCols.map((s, i) => (
              <div key={i} style={{ width: 22, textAlign: "right" }}>
                {s.opp ?? 0}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
          Line id: {line.id}
        </div>
      </div>
    </div>
  );
})()}

      </section>
{showAuthModal && (
  <div className="auth-modal-overlay">
    <div className="auth-modal">
      <h3>Create an account to comment</h3>
      <p>You must be logged in to join the conversation.</p>

      <div className="auth-modal-buttons">
      <button onClick={() => window.dispatchEvent(new Event("open-login-modal"))}>
  Log In
</button>

        <button onClick={() => window.dispatchEvent(new Event("open-login-modal"))}>
  Sign Up
</button>

      </div>

      <button
        className="close-modal"
        onClick={() => setShowAuthModal(false)}
      >
        ✕
      </button>
    </div>
  </div>
)}
<section className="sl-card comments-card">
  <div className="comments-header">
    <h2>Comments</h2>
    <span className="comments-count">{comments.length}</span>
  </div>

  <div className="chat-container">
    {comments.length === 0 ? (
      <div className="empty-comments">
        Be the first to comment on this match 🎾
      </div>
    ) : (
      comments.slice().reverse().map((comment) => (
        <div key={comment.id} className="chat-message">
          <div className="avatar">
            {(comment.user_first_name || "G")[0]}
          </div>

          <div className="message-content">
            <div className="message-top">
              <span className="message-user">
                {comment.user_first_name || "Guest"}
              </span>
              <span className="message-timestamp">
                {new Date(comment.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="message-text">
              {comment.text}
            </div>
          </div>
        </div>
      ))
    )}
  </div>

  <form onSubmit={handleCommentSubmit} className="comment-input-container">
    <input
      type="text"
      value={newComment}
      onChange={(e) => setNewComment(e.target.value)}
      placeholder="Add a comment…"
      className="comment-input"
    />
    <button type="submit" className="comment-submit-button">
      ➤
    </button>
  </form>
</section>

    </main>
    <Footer />
        </>
  );
}
