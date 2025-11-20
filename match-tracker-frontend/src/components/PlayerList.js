// src/pages/PlayerList.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles.css";
import { useAuth } from "../AuthContext";
import API_BASE_URL from "../config";

// ------------ Top Nav (same look as Schedule/Dashboard)
function TopNav({ hasLive }) {
  const { user, logout } = useAuth();
  const displayName = user ? user.email : "Guest";

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
        <Link to="/players" className="sl-navlink sl-navlink-accent">Roster</Link>
        <Link to="/schedule" className="sl-navlink">Schedule</Link>
        {hasLive && <Link to="/livescore" className="sl-navlink">Live Scores</Link>}
        <Link to="/admin" className="sl-navlink">Admin Panel</Link>
      </nav>

      <div className="sl-userbox">
        <span className="sl-username">{displayName}</span>
      </div>
    </header>
  );
}

// ------------ helpers
const normGender = (g) => {
  const s = String(g || "").toLowerCase();
  if (["m","male","men","man"].includes(s)) return "men";
  if (["f","female","women","woman"].includes(s)) return "women";
  return "unknown";
};

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// robust live check for the top bar
async function hasLiveMatch() {
  for (const u of [
    `${API_BASE_URL}/schedule?status=live`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : [d];
    if (arr.some(m => String(m?.status || "").toLowerCase() === "live")) return true;
  }
  return false;
}

async function getRosterByGender(gender) {
  const urls = [
    `${API_BASE_URL}/players?gender=${gender}`,
    `${API_BASE_URL}/players`,
  ];
  for (const u of urls) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : d.items || d.results || [d];
    const mapped = arr.map((p) => ({
      id: p.id ?? `${p.first_name || ""}-${p.last_name || ""}-${p.email || ""}`,
      name: p.name || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
      year: p.year?.trim?.() || p.class || "",
      gender: normGender(p.gender),
      singles_season: p.singles_season || "",
      singles_all_time: p.singles_all_time || "",
      doubles_season: p.doubles_season || "",
      doubles_all_time: p.doubles_all_time || "",
      hand: p.hand || "",
    }));
    const filtered = mapped.filter((p) => p.gender === gender);
    if (u.includes("?gender=")) return filtered;
    if (filtered.length || mapped.length) return filtered.length ? filtered : mapped;
  }
  return [];
}

const YEAR_ORDER = { Senior: 4, Junior: 3, Sophomore: 2, Freshman: 1 };

// ------------ Small UI bits
function PlayerCard({ p, isAdmin, token, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...p });

  useEffect(() => setForm({ ...p }), [p.id]); // refresh when switching

  const save = async () => {
    const res = await fetch(`${API_BASE_URL}/players/${p.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setEditing(false);
      onEdit?.();
    } else {
      alert("Failed to update player.");
    }
  };

  return (
    <div className="sl-card" style={{ padding: 12 }}>
      {!editing ? (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontWeight:700, color:"#123" }}>{p.name}</div>
            {isAdmin && (
              <div style={{ display:"flex", gap:8 }}>
                <button className="sl-navlink" onClick={() => setEditing(true)}>Edit</button>
                <button
                  className="sl-logout"
                  onClick={() => onDelete?.(p.id)}
                  style={{ borderColor:"#f3c1c1" }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <div style={{ color:"#5c6b62", fontSize:13, marginTop:4 }}>
            {p.year ? `Year: ${p.year}` : "Year: —"} {p.hand ? `• ${p.hand}` : ""}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10, fontSize:13 }}>
            <div className="sl-card" style={{ padding:8 }}>
              <div style={{ fontWeight:700, color:"#174d2a" }}>Singles</div>
              <div>Season: {p.singles_season || "—"}</div>
              <div>All-Time: {p.singles_all_time || "—"}</div>
            </div>
            <div className="sl-card" style={{ padding:8 }}>
              <div style={{ fontWeight:700, color:"#174d2a" }}>Doubles</div>
              <div>Season: {p.doubles_season || "—"}</div>
              <div>All-Time: {p.doubles_all_time || "—"}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight:700, color:"#174d2a", marginBottom:8 }}>Edit Player</div>
          <div style={{ display:"grid", gap:8 }}>
            <input
              value={form.name}
              onChange={(e)=>setForm(f=>({...f,name:e.target.value}))}
              placeholder="Name"
            />
            <input
              value={form.year}
              onChange={(e)=>setForm(f=>({...f,year:e.target.value}))}
              placeholder="Year (Freshman…Senior)"
            />
            <select
              value={form.gender || ""}
              onChange={(e)=>setForm(f=>({...f,gender:e.target.value}))}
            >
              <option value="">Gender</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
            <input
              value={form.singles_season}
              onChange={(e)=>setForm(f=>({...f,singles_season:e.target.value}))}
              placeholder="Singles (Season)"
            />
            <input
              value={form.singles_all_time}
              onChange={(e)=>setForm(f=>({...f,singles_all_time:e.target.value}))}
              placeholder="Singles (All-Time)"
            />
            <input
              value={form.doubles_season}
              onChange={(e)=>setForm(f=>({...f,doubles_season:e.target.value}))}
              placeholder="Doubles (Season)"
            />
            <input
              value={form.doubles_all_time}
              onChange={(e)=>setForm(f=>({...f,doubles_all_time:e.target.value}))}
              placeholder="Doubles (All-Time)"
            />
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button className="sl-view-btn" onClick={save}>Save</button>
              <button className="sl-logout" onClick={()=>setEditing(false)}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function PlayerList() {
  const { isAdmin, token } = useAuth();

  const [tab, setTab] = useState("men"); // 'men' | 'women'
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    year: "",
    gender: "men",
    singles_season: "",
    singles_all_time: "",
    doubles_season: "",
    doubles_all_time: "",
    hand: ""
  });

  // fetch roster + live flag on tab change
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [r, liveFlag] = await Promise.all([
        getRosterByGender(tab),
        hasLiveMatch(),
      ]);
      if (!mounted) return;
      setPlayers(r || []);
      setLive(liveFlag);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [tab]);

  const sorted = useMemo(() => {
    const copy = [...players];
    copy.sort(
      (a,b) => (YEAR_ORDER[b.year?.trim?.()]||0) - (YEAR_ORDER[a.year?.trim?.()]||0)
    );
    return copy;
  }, [players]);

  const onDelete = async (id) => {
    if (!window.confirm("Delete this player?")) return;
    const res = await fetch(`${API_BASE_URL}/players/${id}`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (res.ok) setPlayers((prev) => prev.filter(p => p.id !== id));
    else alert("Failed to delete player.");
  };

  const onEditDone = async () => {
    const r = await getRosterByGender(tab);
    setPlayers(r || []);
  };

  const submitNew = async (e) => {
    e.preventDefault();
    const payload = { ...newPlayer, gender: tab }; // ensure player lands in current tab
    const res = await fetch(`${API_BASE_URL}/players`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowForm(false);
      setNewPlayer({
        name: "",
        year: "",
        gender: tab,
        singles_season: "",
        singles_all_time: "",
        doubles_season: "",
        doubles_all_time: "",
        hand: ""
      });
      const r = await getRosterByGender(tab);
      setPlayers(r || []);
    } else {
      alert("Failed to add player.");
    }
  };

  return (
    <>
      <TopNav hasLive={live} />

      <div className="sl-main" style={{ maxWidth: 1100, margin: "16px auto", padding: "0 16px" }}>
        <h1 className="sl-welcome">Roster</h1>
        <p className="sl-subtitle">Browse players by team, quick edit stats</p>

        {/* Men / Women tabs */}
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
            <button
              className="sl-navlink"
              onClick={() => setShowForm(s => !s)}
              style={{ marginLeft: "auto" }}
            >
              {showForm ? "Cancel" : "Add Player"}
            </button>
          )}
        </div>

        {/* Add Player (admin) */}
        {isAdmin && showForm && (
          <form
            onSubmit={submitNew}
            className="sl-card"
            style={{ padding: 14, marginBottom: 12 }}
          >
            <div
              style={{
                display:"grid",
                gap:8,
                gridTemplateColumns:"1fr 1fr",
                alignItems:"center"
              }}
            >
              <input
                name="name"
                placeholder="Name"
                value={newPlayer.name}
                onChange={(e)=>setNewPlayer(f=>({...f,name:e.target.value}))}
                required
              />
              <input
                name="year"
                placeholder="Year (Freshman…Senior)"
                value={newPlayer.year}
                onChange={(e)=>setNewPlayer(f=>({...f,year:e.target.value}))}
              />
              <select
                name="gender"
                value={newPlayer.gender}
                onChange={(e)=>setNewPlayer(f=>({...f,gender:e.target.value}))}
              >
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
              <input
                name="hand"
                placeholder="Hand (R/L)"
                value={newPlayer.hand}
                onChange={(e)=>setNewPlayer(f=>({...f,hand:e.target.value}))}
              />
              <input
                name="singles_season"
                placeholder="Singles (Season)"
                value={newPlayer.singles_season}
                onChange={(e)=>setNewPlayer(f=>({...f,singles_season:e.target.value}))}
              />
              <input
                name="singles_all_time"
                placeholder="Singles (All-Time)"
                value={newPlayer.singles_all_time}
                onChange={(e)=>setNewPlayer(f=>({...f,singles_all_time:e.target.value}))}
              />
              <input
                name="doubles_season"
                placeholder="Doubles (Season)"
                value={newPlayer.doubles_season}
                onChange={(e)=>setNewPlayer(f=>({...f,doubles_season:e.target.value}))}
              />
              <input
                name="doubles_all_time"
                placeholder="Doubles (All-Time)"
                value={newPlayer.doubles_all_time}
                onChange={(e)=>setNewPlayer(f=>({...f,doubles_all_time:e.target.value}))}
              />
            </div>
            <div style={{ marginTop:10 }}>
              <button type="submit" className="sl-view-btn">
                Add Player ({tab})
              </button>
            </div>
          </form>
        )}

        {/* Roster grid */}
        {loading ? (
          <div className="sl-card sl-skeleton">Loading…</div>
        ) : (
          <div
            style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",
              gap:12
            }}
          >
            {sorted.map((p) => (
              <PlayerCard
                key={p.id}
                p={p}
                isAdmin={isAdmin}
                token={token}
                onEdit={onEditDone}
                onDelete={onDelete}
              />
            ))}
            {!sorted.length && (
              <div className="sl-card" style={{ padding: 14 }}>
                <div style={{ color:"#4f6475" }}>No players found.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
