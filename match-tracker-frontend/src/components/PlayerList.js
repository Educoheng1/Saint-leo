// src/pages/PlayerList.js
import React, { useEffect, useMemo, useState } from "react";
import "../styles.css";
import Footer from "./Footer";
import TopNav from "./Topnav";
import { useAuth } from "../AuthContext";
import API_BASE_URL from "../config";

// ------------ helpers
const normGender = (g) => {
  const s = String(g || "").toLowerCase();
  if (["m", "male", "men", "man"].includes(s)) return "men";
  if (["f", "female", "women", "woman"].includes(s)) return "women";
  return "unknown";
};

const toIntOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtRecord = (w, l) => {
  const ww = w === "" || w === null || w === undefined ? "—" : w;
  const ll = l === "" || l === null || l === undefined ? "—" : l;
  return `${ww}-${ll}`;
};

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// robust live check for the top bar
async function hasLiveMatch() {
  for (const u of [`${API_BASE_URL}/schedule?status=live`, `${API_BASE_URL}/schedule`]) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : [d];
    if (arr.some((m) => String(m?.status || "").toLowerCase() === "live")) return true;
  }
  return false;
}

async function getRosterByGender(gender) {
  const urls = [`${API_BASE_URL}/players?gender=${gender}`, `${API_BASE_URL}/players`];
  for (const u of urls) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : d.items || d.results || [d];

    const mapped = arr.map((p) => ({
      id: p.id ?? `${p.first_name || ""}-${p.last_name || ""}-${p.email || ""}`,
      name:
        p.name ||
        p.full_name ||
        [p.first_name, p.last_name].filter(Boolean).join(" ") ||
        "Unnamed",
      year: p.year?.trim?.() || p.class || "",
      gender: normGender(p.gender),

      // wins/losses fields (must match backend/DB column names)
      singles_season_wins: p.singles_season_wins ?? "",
      singles_season_losses: p.singles_season_losses ?? "",
      singles_all_time_wins: p.singles_all_time_wins ?? "",
      singles_all_time_losses: p.singles_all_time_losses ?? "",

      doubles_season_wins: p.doubles_season_wins ?? "",
      doubles_season_losses: p.doubles_season_losses ?? "",
      doubles_all_time_wins: p.doubles_all_time_wins ?? "",
      doubles_all_time_losses: p.doubles_all_time_losses ?? "",

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
    // Convert numeric fields before sending
    const payload = {
      ...form,
      singles_season_wins: toIntOrNull(form.singles_season_wins),
      singles_season_losses: toIntOrNull(form.singles_season_losses),
      singles_all_time_wins: toIntOrNull(form.singles_all_time_wins),
      singles_all_time_losses: toIntOrNull(form.singles_all_time_losses),

      doubles_season_wins: toIntOrNull(form.doubles_season_wins),
      doubles_season_losses: toIntOrNull(form.doubles_season_losses),
      doubles_all_time_wins: toIntOrNull(form.doubles_all_time_wins),
      doubles_all_time_losses: toIntOrNull(form.doubles_all_time_losses),
    };

    const res = await fetch(`${API_BASE_URL}/players/${p.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setEditing(false);
      onEdit?.();
    } else {
      const txt = await res.text().catch(() => "");
      alert(`Failed to update player.\n${txt}`);
    }
  };

  return (
    <div className="sl-card" style={{ padding: 12 }}>
      {!editing ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: "#123" }}>{p.name}</div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="sl-navlink" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button
                  className="sl-logout"
                  onClick={() => onDelete?.(p.id)}
                  style={{ borderColor: "#f3c1c1" }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          <div style={{ color: "#5c6b62", fontSize: 13, marginTop: 4 }}>
            {p.year ? `Year: ${p.year}` : "Year: —"} {p.hand ? `• ${p.hand}` : ""}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 10,
              fontSize: 13,
            }}
          >
            <div className="sl-card" style={{ padding: 8 }}>
              <div style={{ fontWeight: 700, color: "#174d2a" }}>Singles</div>
              <div>Season: {fmtRecord(p.singles_season_wins, p.singles_season_losses)}</div>
              <div>All-Time: {fmtRecord(p.singles_all_time_wins, p.singles_all_time_losses)}</div>
            </div>

            <div className="sl-card" style={{ padding: 8 }}>
              <div style={{ fontWeight: 700, color: "#174d2a" }}>Doubles</div>
              <div>Season: {fmtRecord(p.doubles_season_wins, p.doubles_season_losses)}</div>
              <div>All-Time: {fmtRecord(p.doubles_all_time_wins, p.doubles_all_time_losses)}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, color: "#174d2a", marginBottom: 8 }}>Edit Player</div>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name"
            />

            <input
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              placeholder="Year (Freshman…Senior)"
            />

            <select
              value={form.gender || ""}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            >
              <option value="">Gender</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>

            <div className="sl-card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Singles</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="number"
                  value={form.singles_season_wins}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, singles_season_wins: e.target.value }))
                  }
                  placeholder="Season Wins"
                />
                <input
                  type="number"
                  value={form.singles_season_losses}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, singles_season_losses: e.target.value }))
                  }
                  placeholder="Season Losses"
                />
                <input
                  type="number"
                  value={form.singles_all_time_wins}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, singles_all_time_wins: e.target.value }))
                  }
                  placeholder="All-Time Wins"
                />
                <input
                  type="number"
                  value={form.singles_all_time_losses}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, singles_all_time_losses: e.target.value }))
                  }
                  placeholder="All-Time Losses"
                />
              </div>
            </div>

            <div className="sl-card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Doubles</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  type="number"
                  value={form.doubles_season_wins}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, doubles_season_wins: e.target.value }))
                  }
                  placeholder="Season Wins"
                />
                <input
                  type="number"
                  value={form.doubles_season_losses}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, doubles_season_losses: e.target.value }))
                  }
                  placeholder="Season Losses"
                />
                <input
                  type="number"
                  value={form.doubles_all_time_wins}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, doubles_all_time_wins: e.target.value }))
                  }
                  placeholder="All-Time Wins"
                />
                <input
                  type="number"
                  value={form.doubles_all_time_losses}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, doubles_all_time_losses: e.target.value }))
                  }
                  placeholder="All-Time Losses"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="sl-view-btn" onClick={save}>
                Save
              </button>
              <button className="sl-logout" onClick={() => setEditing(false)}>
                Cancel
              </button>
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

    singles_season_wins: "",
    singles_season_losses: "",
    singles_all_time_wins: "",
    singles_all_time_losses: "",

    doubles_season_wins: "",
    doubles_season_losses: "",
    doubles_all_time_wins: "",
    doubles_all_time_losses: "",

    hand: "",
  });

  // fetch roster + live flag on tab change
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [r, liveFlag] = await Promise.all([getRosterByGender(tab), hasLiveMatch()]);
      if (!mounted) return;
      setPlayers(r || []);
      setLive(liveFlag);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [tab]);

  const sorted = useMemo(() => {
    const copy = [...players];
    copy.sort((a, b) => (YEAR_ORDER[b.year?.trim?.()] || 0) - (YEAR_ORDER[a.year?.trim?.()] || 0));
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
    if (res.ok) setPlayers((prev) => prev.filter((p) => p.id !== id));
    else alert("Failed to delete player.");
  };

  const onEditDone = async () => {
    const r = await getRosterByGender(tab);
    setPlayers(r || []);
  };

  const submitNew = async (e) => {
    e.preventDefault();

    const payload = {
      ...newPlayer,
      gender: tab, // ensure player lands in current tab

      singles_season_wins: toIntOrNull(newPlayer.singles_season_wins),
      singles_season_losses: toIntOrNull(newPlayer.singles_season_losses),
      singles_all_time_wins: toIntOrNull(newPlayer.singles_all_time_wins),
      singles_all_time_losses: toIntOrNull(newPlayer.singles_all_time_losses),

      doubles_season_wins: toIntOrNull(newPlayer.doubles_season_wins),
      doubles_season_losses: toIntOrNull(newPlayer.doubles_season_losses),
      doubles_all_time_wins: toIntOrNull(newPlayer.doubles_all_time_wins),
      doubles_all_time_losses: toIntOrNull(newPlayer.doubles_all_time_losses),
    };

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

        singles_season_wins: "",
        singles_season_losses: "",
        singles_all_time_wins: "",
        singles_all_time_losses: "",

        doubles_season_wins: "",
        doubles_season_losses: "",
        doubles_all_time_wins: "",
        doubles_all_time_losses: "",

        hand: "",
      });

      const r = await getRosterByGender(tab);
      setPlayers(r || []);
    } else {
      const txt = await res.text().catch(() => "");
      alert(`Failed to add player.\n${txt}`);
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
              onClick={() => setShowForm((s) => !s)}
              style={{ marginLeft: "auto" }}
            >
              {showForm ? "Cancel" : "Add Player"}
            </button>
          )}
        </div>

        {/* Add Player (admin) */}
        {isAdmin && showForm && (
          <form onSubmit={submitNew} className="sl-card" style={{ padding: 14, marginBottom: 12 }}>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr 1fr",
                alignItems: "center",
              }}
            >
              <input
                name="name"
                placeholder="Name"
                value={newPlayer.name}
                onChange={(e) => setNewPlayer((f) => ({ ...f, name: e.target.value }))}
                required
              />

              <input
                name="year"
                placeholder="Year (Freshman…Senior)"
                value={newPlayer.year}
                onChange={(e) => setNewPlayer((f) => ({ ...f, year: e.target.value }))}
              />

              <select
                name="gender"
                value={newPlayer.gender}
                onChange={(e) => setNewPlayer((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>

              <input
                name="hand"
                placeholder="Hand (R/L)"
                value={newPlayer.hand}
                onChange={(e) => setNewPlayer((f) => ({ ...f, hand: e.target.value }))}
              />

              {/* Singles */}
              <input
                type="number"
                name="singles_season_wins"
                placeholder="Singles Season Wins"
                value={newPlayer.singles_season_wins}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, singles_season_wins: e.target.value }))
                }
              />
              <input
                type="number"
                name="singles_season_losses"
                placeholder="Singles Season Losses"
                value={newPlayer.singles_season_losses}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, singles_season_losses: e.target.value }))
                }
              />
              <input
                type="number"
                name="singles_all_time_wins"
                placeholder="Singles All-Time Wins"
                value={newPlayer.singles_all_time_wins}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, singles_all_time_wins: e.target.value }))
                }
              />
              <input
                type="number"
                name="singles_all_time_losses"
                placeholder="Singles All-Time Losses"
                value={newPlayer.singles_all_time_losses}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, singles_all_time_losses: e.target.value }))
                }
              />

              {/* Doubles */}
              <input
                type="number"
                name="doubles_season_wins"
                placeholder="Doubles Season Wins"
                value={newPlayer.doubles_season_wins}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, doubles_season_wins: e.target.value }))
                }
              />
              <input
                type="number"
                name="doubles_season_losses"
                placeholder="Doubles Season Losses"
                value={newPlayer.doubles_season_losses}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, doubles_season_losses: e.target.value }))
                }
              />
              <input
                type="number"
                name="doubles_all_time_wins"
                placeholder="Doubles All-Time Wins"
                value={newPlayer.doubles_all_time_wins}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, doubles_all_time_wins: e.target.value }))
                }
              />
              <input
                type="number"
                name="doubles_all_time_losses"
                placeholder="Doubles All-Time Losses"
                value={newPlayer.doubles_all_time_losses}
                onChange={(e) =>
                  setNewPlayer((f) => ({ ...f, doubles_all_time_losses: e.target.value }))
                }
              />
            </div>

            <div style={{ marginTop: 10 }}>
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
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
              gap: 12,
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
                <div style={{ color: "#4f6475" }}>No players found.</div>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
