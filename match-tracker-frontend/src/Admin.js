// src/Admin.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./styles.css";
import API_BASE_URL from "./config";
import { useAdmin } from "./AdminContext";
import { ScoreInput } from "./components/LiveScore"; // we added this component earlier

/* ---------------- Top Nav (same look) ---------------- */
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
        <Link to="/schedule" className="sl-navlink">Schedule</Link>
        {hasLive && <Link to="/livescore" className="sl-navlink sl-navlink-accent">Live Scores</Link>}
        <Link to="/admin" className="sl-navlink sl-navlink-accent">Admin Panel</Link>
      </nav>

      <div className="sl-userbox">
        <span className="sl-username">{name}</span>
        <button className="sl-logout" onClick={() => { localStorage.clear(); }}>
          Logout
        </button>
      </div>
    </header>
  );
}

/* ---------------- utils ---------------- */
const TOKEN = localStorage.getItem("token") || "";
const headers = {
  "Content-Type": "application/json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function fetchJSON(url, opt={}) {
  try {
    const r = await fetch(url, { headers, ...opt });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function postJSON(url, data) { return fetchJSON(url, { method: "POST", body: JSON.stringify(data) }); }
async function putJSON(url, data)  { return fetchJSON(url, { method: "PUT",  body: JSON.stringify(data) }); }
async function patchJSON(url, data){ return fetchJSON(url, { method: "PATCH",body: JSON.stringify(data) }); }
async function del(url)            { try { const r = await fetch(url, { method:"DELETE", headers }); return r.ok; } catch { return false; } }

const normGender = (g) => {
  const s = String(g||"").toLowerCase();
  if (["m","male","men","man"].includes(s)) return "men";
  if (["f","female","women","woman"].includes(s)) return "women";
  return "unknown";
};
const parseDateSafe = (isoish) => {
  if (!isoish) return null;
  const s = String(isoish).replace(" ", "T").replace(/\.\d+$/, "");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = (iso) => {
  const d = parseDateSafe(iso);
  return d ? d.toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "TBD";
};
const setsToString = (sets) => {
  if (!Array.isArray(sets)) return "";
  const arr = Array.isArray(sets[0]) ? sets : sets.map(s => [s.team, s.opp]);
  return arr.map(p => `${p?.[0] ?? 0}-${p?.[1] ?? 0}`).join(", ");
};
const stringToSets = (txt) => {
  if (!txt) return [];
  return String(txt)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const [a,b] = pair.split(/[-–]/).map(n => parseInt(n.trim(),10));
      return [isFinite(a)?a:0, isFinite(b)?b:0];
    });
};
const looksLive = (m) => {
  const st = String(m?.status ?? "").toLowerCase();
  const started = Boolean(m?.started);
  return (st==="live" || st==="in_progress" || st==="in-progress" || started) && st!=="completed";
};

/* ---------------- data loaders (players / schedule / live) ---------------- */
async function loadPlayers() {
  const d = await fetchJSON(`${API_BASE_URL}/players`) || await fetchJSON(`${API_BASE_URL}/roster`);
  if (!Array.isArray(d)) return [];
  return d.map(p => ({
    id: p.id,
    name: p.full_name || p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
    gender: normGender(p.gender),
    year: p.year || p.class || "",
    hand: p.hand || "",
    singles_season: p.singles_season || "",
    singles_all_time: p.singles_all_time || "",
    doubles_season: p.doubles_season || "",
    doubles_all_time: p.doubles_all_time || "",
  }));
}
async function loadMatches() {
  let d = await fetchJSON(`${API_BASE_URL}/schedule`);
  if (!Array.isArray(d)) d = await fetchJSON(`${API_BASE_URL}/schedule`) || [];
  if (!Array.isArray(d)) return [];
  return d.map(m => ({
    id: m.id,
    date: m.date,
    gender: normGender(m.gender),
    opponent: m.opponent,
    venue: m.location,            // avoid variable name "location"
    status: m.status || "scheduled",
    match_number: m.match_number,
    winner: m.winner ?? null,
    started: m.started ?? 0,
  }));
}
async function loadLive() {
  for (const u of [
    `${API_BASE_URL}/schedule?status=live`,
    `${API_BASE_URL}/schedule`,
  ]) {
    const d = await fetchJSON(u);
    if (!d) continue;
    const arr = Array.isArray(d) ? d : [d];
    const found = arr.find(looksLive);
    if (found) return found;
  }
  return null;
}
async function loadScores(matchId) {
  const d = await fetchJSON(`${API_BASE_URL}/scores/match/${matchId}/all`);
  return Array.isArray(d) ? d : [];
}

/* ---------------- actions (resilient to backend shapes) ---------------- */
// Players
async function createPlayer(p) { return postJSON(`${API_BASE_URL}/players`, p); }
async function updatePlayer(id, p) {
  return (await putJSON(`${API_BASE_URL}/players/${id}`, p)) || (await patchJSON(`${API_BASE_URL}/players/${id}`, p));
}
async function deletePlayer(id) { return del(`${API_BASE_URL}/players/${id}`); }

// Schedule
async function createMatch(m) { return postJSON(`${API_BASE_URL}/schedule`, m) || postJSON(`${API_BASE_URL}/schedule`, m); }
async function updateMatch(id, m) {
  return (await putJSON(`${API_BASE_URL}/schedule/${id}`, m))
      || (await putJSON(`${API_BASE_URL}/schedule/${id}`, m))
      || (await patchJSON(`${API_BASE_URL}/schedule/${id}`, m));
}
async function deleteMatch(id) {
  return (await del(`${API_BASE_URL}/schedule/${id}`)) || (await del(`${API_BASE_URL}/schedule/${id}`));
}

// Live controls
async function startMatch(id) {
  const body = { status:"live", started:1 };
  return (await putJSON(`${API_BASE_URL}/schedule/${id}`, body))
      || (await patchJSON(`${API_BASE_URL}/schedule/${id}`, body))
      || (await postJSON(`${API_BASE_URL}/schedule/${id}/start`, {}))
      || (await putJSON(`${API_BASE_URL}/schedule/${id}`, body));
}
export async function endMatch(id, winner = "team") {
  const res = await fetch(`/schedule/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ winner }),
  });
  if (!res.ok) {
    console.error("endMatch failed", res.status, await res.text());
    return false;
  }
  return true;
}

// Scores
async function saveScoreLine(matchId, row) {
  const payload = {
    match_id: matchId,
    match_type: row.match_type,
    line_no: row.line_no,
    player1: row.player1,
    player2: row.player2 || null,
    opponent1: row.opponent1,
    opponent2: row.opponent2 || null,
    sets: Array.isArray(row.sets) ? row.sets : stringToSets(row.setsText),
    current_game: row.current_game || [0, 0],
    current_serve: row.current_serve ?? 0,
    status: row.status || "live",
    winner: row.winner || null,
  };

  try {
    const r = await fetch(`${API_BASE_URL}/scores`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  } catch (err) {
    console.error("saveScoreLine error:", err);
    alert("Error saving line: " + err.message);
    return null;
  }
}

async function deleteScoreLine(matchId, id) {
  return (await del(`${API_BASE_URL}/scores/${id}`))
      || (await del(`${API_BASE_URL}//scores/match/${matchId}/all/${id}`));
}

/* ---------------- small UI bits ---------------- */
function Field({ label, children }) {
  return (
    <label style={{ display:"grid", gap:6 }}>
      <span style={{ fontSize:12, color:"#5c6b62" }}>{label}</span>
      {children}
    </label>
  );
}
function Row({ children }) {
  return <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(180px,1fr))", gap:10 }}>{children}</div>;
}

/* ---------------- Admin Panel ---------------- */
export default function Admin() {
  const { isAdmin } = useAdmin();
  const guestName = localStorage.getItem("guestName") || (isAdmin ? "Admin" : "Guest");

  const [tab, setTab] = useState("live"); // 'live' | 'schedule' | 'players'
  const [hasLive, setHasLive] = useState(false);

  // players
  const [players, setPlayers] = useState([]);
  const [pForm, setPForm] = useState({ name:"", gender:"men", year:"", hand:"" });
  const [editingPlayer, setEditingPlayer] = useState(null);

  // schedule
  const [genderTab, setGenderTab] = useState("men");
  const [matches, setMatches] = useState([]);
  const [mForm, setMForm] = useState({ date:"", opponent:"", venue:"", status:"scheduled" });
  const [editingMatch, setEditingMatch] = useState(null);

  // live
  const [liveMatch, setLiveMatch] = useState(null);
  const [lines, setLines] = useState([]);

  /* ----- boot ----- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [pl, ms, lm] = await Promise.all([loadPlayers(), loadMatches(), loadLive()]);
      if (!mounted) return;
      setPlayers(pl);
      setMatches(ms);
      setLiveMatch(lm);
      setHasLive(Boolean(lm));
      if (lm?.id) setLines(await loadScores(lm.id));
    })();
    const t = setInterval(async () => {
      const lm = await loadLive();
      setLiveMatch(lm);
      setHasLive(Boolean(lm));
      if (lm?.id) setLines(await loadScores(lm.id));
    }, 8000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  /* ----- derived ----- */
  const matchesByGender = useMemo(() => matches.filter(m => m.gender===genderTab), [matches, genderTab]);
  const scheduled = matchesByGender.filter(m => m.status?.toLowerCase() === "scheduled").sort((a,b)=> (parseDateSafe(a.date)?.getTime() ?? 0) - (parseDateSafe(b.date)?.getTime() ?? 0));
  const completed = matchesByGender.filter(m => m.status?.toLowerCase() === "completed").sort((a,b)=> (parseDateSafe(b.date)?.getTime() ?? 0) - (parseDateSafe(a.date)?.getTime() ?? 0));

  /* ---------------- Players tab handlers ---------------- */
  const addPlayer = async (e) => {
    e.preventDefault();
    const payload = { ...pForm, gender: pForm.gender };
    const res = await createPlayer(payload);
    if (res) {
      setPForm({ name:"", gender:pForm.gender, year:"", hand:"" });
      setPlayers(await loadPlayers());
    } else alert("Failed to add player");
  };
  const savePlayer = async () => {
    if (!editingPlayer) return;
    const ok = await updatePlayer(editingPlayer.id, editingPlayer);
    if (ok) {
      setEditingPlayer(null);
      setPlayers(await loadPlayers());
    } else alert("Failed to update player");
  };
  const removePlayer = async (id) => {
    if (!window.confirm("Delete this player?")) return;
    const ok = await deletePlayer(id);
    if (ok) setPlayers(p => p.filter(pl => pl.id !== id));
    else alert("Failed to delete player");
  };

  /* ---------------- Schedule tab handlers ---------------- */
  const addMatch = async (e) => {
    e.preventDefault();
    const body = {
      date: new Date(mForm.date).toISOString().replace("Z",""),
      gender: genderTab,
      opponent: mForm.opponent,
      location: mForm.venue,
      status: mForm.status || "scheduled",
      match_number: Date.now(),
      winner: null,
    };
    const res = await createMatch(body);
    if (res) {
      setMForm({ date:"", opponent:"", venue:"", status:"scheduled" });
      setMatches(await loadMatches());
    } else alert("Failed to create match");
  };
  const saveMatch = async () => {
    if (!editingMatch) return;
    const body = {
      ...editingMatch,
      gender: editingMatch.gender || genderTab,
      location: editingMatch.venue,
    };
    const ok = await updateMatch(editingMatch.id, body);
    if (ok) {
      setEditingMatch(null);
      setMatches(await loadMatches());
    } else alert("Failed to update match");
  };
  const removeMatch = async (id) => {
    if (!window.confirm("Delete this match?")) return;
    const ok = await deleteMatch(id);
    if (ok) setMatches(m => m.filter(x => x.id !== id));
    else alert("Failed to delete match");
  };
  const doStart = async (id) => {
    const ok = await startMatch(id);
    if (ok) {
      const lm = await loadLive();
      setLiveMatch(lm);
      if (lm?.id) setLines(await loadScores(lm.id));
      setHasLive(Boolean(lm));
      setTab("live");
    } else alert("Could not start match");
  };
  const doEnd = async (id) => {
    const ok = await endMatch(id);
    if (ok) {
      setLiveMatch(null);
      setLines([]);
      setHasLive(false);
      setMatches(await loadMatches());
    } else alert("Could not end match");
  };

  /* ---------------- Live tab handlers ---------------- */
  const addLine = () => {
    if (!liveMatch?.id) return;
    const next = {
      id: undefined,
      match_id: liveMatch.id,
      match_type: "singles",
      line_no: (lines?.length || 0) + 1,
      player1: "",
      player2: "",
      opponent1: "",
      opponent2: "",
      setsText: "",
      current_game: [0, 0],
      current_serve: 0,
      status: "live",
      winner: null,
    };
    setLines((prev) => [...prev, next]);
  };
  const updateLine = (idx, patch) => {
    setLines(prev => prev.map((r,i) => i===idx ? ({ ...r, ...patch }) : r));
  };
  const saveLine = async (idx) => {
    const row = lines[idx];
    const res = await saveScoreLine(liveMatch.id, row);
    if (res) {
      // reload from server to get IDs/winner calc, etc.
      setLines(await loadScores(liveMatch.id));
    } else alert("Failed to save line");
  };
  const removeLine = async (idx) => {
    const row = lines[idx];
    if (row?.id) {
      const ok = await deleteScoreLine(liveMatch.id, row.id);
      if (!ok) return alert("Failed to delete line");
    }
    setLines(prev => prev.filter((_,i) => i!==idx));
  };

  /* ---------------- render ---------------- */
  return (
    <>
      <TopNav name={guestName} hasLive={hasLive} />

      <div className="sl-main" style={{ maxWidth: 1150, margin: "16px auto", padding: "0 16px" }}>
        <h1 className="sl-welcome">Admin Panel</h1>
        <p className="sl-subtitle">Manage players, schedule, and live scoring</p>

        {/* tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button className={`sl-logout ${tab==="live"?"sl-view-btn":""}`} onClick={()=>setTab("live")}>Live Control</button>
          <button className={`sl-logout ${tab==="schedule"?"sl-view-btn":""}`} onClick={()=>setTab("schedule")}>Schedule</button>
          <button className={`sl-logout ${tab==="players"?"sl-view-btn":""}`} onClick={()=>setTab("players")}>Players</button>
        </div>

        {/* ---------------- LIVE CONTROL ---------------- */}
        {tab==="live" && (
          <>
            <div className="sl-card" style={{ padding:14, marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:800, color:"#174d2a" }}>
                    {liveMatch ? `Live: Lions vs ${liveMatch.opponent || "TBD"}` : "No live match"}
                  </div>
                  {liveMatch && <div style={{ color:"#4f6475" }}>{fmtDate(liveMatch.date)} {liveMatch.location ? `• ${liveMatch.location}` : ""}</div>}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {!liveMatch && (
                    <select
                      onChange={(e)=>doStart(e.target.value)}
                      defaultValue=""
                      style={{ padding:"8px 10px", borderRadius:10, border:"1px solid #e1ebe1" }}
                    >
                      <option value="" disabled>Start scheduled match…</option>
                      {matches.filter(m=>m.status?.toLowerCase()==="scheduled")
                        .sort((a,b)=> (parseDateSafe(a.date)?.getTime()??0)-(parseDateSafe(b.date)?.getTime()??0))
                        .map(m=>(
                          <option key={m.id} value={m.id}>
                            {fmtDate(m.date)} — {m.gender==="men"?"Men":"Women"} vs {m.opponent}
                          </option>
                        ))}
                    </select>
                  )}
                  {liveMatch && <button className="sl-logout" onClick={()=>doEnd(liveMatch.id)}>End Match</button>}
                </div>
              </div>
            </div>

            {/* lines editor */}
            {liveMatch ? (
              <div className="sl-card" style={{ padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color:"#174d2a" }}>Score Lines</div>
                  <button className="sl-navlink" onClick={addLine}>Add Line</button>
                </div>

                <div style={{ display:"grid", gap:10 }}>
                  {lines.map((r, idx) => (
                    <div key={r.id || `new-${idx}`} className="sl-card" style={{ padding:12 }}>
                      <div style={{ display:"grid", gap:10 }}>
                        <Row>
                          <Field label="Type">
                            <select value={r.match_type||"singles"} onChange={(e)=>updateLine(idx,{match_type:e.target.value})}>
                              <option value="singles">Singles</option>
                              <option value="doubles">Doubles</option>
                            </select>
                          </Field>
                          <Field label="Line #">
                            <input type="number" min="1" value={r.line_no||1} onChange={(e)=>updateLine(idx,{line_no:Number(e.target.value)})} />
                          </Field>
                        </Row>

                        <Row>
                          <Field label="Team Player(s)">
                            <input value={r.match_type==="doubles"
                                      ? (r.player1||"") + (r.player2?` & ${r.player2}`:"")
                                      : (r.player1||"")}
                                   onChange={(e)=>{
                                     const txt = e.target.value;
                                     if ((r.match_type||"").toLowerCase()==="doubles" && txt.includes("&")) {
                                       const [p1,p2] = txt.split("&").map(s=>s.trim());
                                       updateLine(idx,{player1:p1, player2:p2});
                                     } else {
                                       updateLine(idx,{player1:txt, player2: r.match_type==="doubles" ? (r.player2||"") : ""});
                                     }
                                   }} placeholder={r.match_type==="doubles"?"John & Jack":"John"} />
                          </Field>
                          <Field label="Opponent(s)">
                            <input value={r.match_type==="doubles"
                                      ? (r.opponent1||"") + (r.opponent2?` & ${r.opponent2}`:"")
                                      : (r.opponent1||"")}
                                   onChange={(e)=>{
                                     const txt = e.target.value;
                                     if ((r.match_type||"").toLowerCase()==="doubles" && txt.includes("&")) {
                                       const [o1,o2] = txt.split("&").map(s=>s.trim());
                                       updateLine(idx,{opponent1:o1, opponent2:o2});
                                     } else {
                                       updateLine(idx,{opponent1:txt, opponent2: r.match_type==="doubles" ? (r.opponent2||"") : ""});
                                     }
                                   }} placeholder={r.match_type==="doubles"?"Opp A & Opp B":"Opp A"} />
                          </Field>
                        </Row>

                        <Row>
                          <Field label="Sets (e.g., 6-4, 4-6, 7-5)">
                            <input value={r.setsText ?? setsToString(r.sets)} onChange={(e)=>updateLine(idx,{setsText:e.target.value})} />
                          </Field>
                          <Field label="Current Game">
                            <ScoreInput value={r.current_game || [0,0]} onChange={(val)=>updateLine(idx,{current_game:val})} />
                          </Field>
                        </Row>

                        <Row>
                          <Field label="Serve">
                            <select value={Number(r.current_serve ?? 0)} onChange={(e)=>updateLine(idx,{current_serve:Number(e.target.value)})}>
                              <option value={0}>Team</option>
                              <option value={1}>Opponent</option>
                            </select>
                          </Field>
                          <Field label="Status">
                            <select value={r.status || "live"} onChange={(e)=>updateLine(idx,{status:e.target.value})}>
                              <option value="live">Live</option>
                              <option value="completed">Completed</option>
                              <option value="pending">Pending</option>
                            </select>
                          </Field>
                        </Row>

                        <Row>
                          <Field label="Winner (dual point)">
                            <select value={r.winner ?? ""} onChange={(e)=>updateLine(idx,{winner:e.target.value || null})}>
                              <option value="">—</option>
                              <option value="team">Team</option>
                              <option value="opponent">Opponent</option>
                            </select>
                          </Field>
                          <div />
                        </Row>

                        <div style={{ display:"flex", gap:8 }}>
                          <button className="sl-view-btn" onClick={()=>saveLine(idx)}>Save Line</button>
                          <button className="sl-logout" onClick={()=>removeLine(idx)} style={{ borderColor:"#f3c1c1" }}>Delete Line</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!lines.length && <div style={{ color:"#4f6475" }}>No lines yet — add one above.</div>}
                </div>
              </div>
            ) : (
              <div className="sl-card sl-empty">No live match active. Start one from the selector above.</div>
            )}
          </>
        )}

        {/* ---------------- SCHEDULE ---------------- */}
        {tab==="schedule" && (
          <>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <button className={`sl-logout ${genderTab==="men"?"sl-view-btn":""}`} onClick={()=>setGenderTab("men")}>Men</button>
              <button className={`sl-logout ${genderTab==="women"?"sl-view-btn":""}`} onClick={()=>setGenderTab("women")}>Women</button>
            </div>

            {/* Add / Edit form */}
            <div className="sl-card" style={{ padding:14, marginBottom:12 }}>
              <div style={{ fontWeight:700, color:"#174d2a", marginBottom:8 }}>{editingMatch ? "Edit Match" : "Add Match"}</div>
              <form onSubmit={addMatch}>
                <Row>
                  <Field label="Date & time">
                    <input type="datetime-local" required value={editingMatch?editingMatch.date:mForm.date} onChange={(e)=> (editingMatch ? setEditingMatch({...editingMatch, date:e.target.value}) : setMForm({...mForm, date:e.target.value}))} />
                  </Field>
                  <Field label="Opponent">
                    <input required value={editingMatch?editingMatch.opponent:mForm.opponent} onChange={(e)=> (editingMatch ? setEditingMatch({...editingMatch, opponent:e.target.value}) : setMForm({...mForm, opponent:e.target.value}))} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Location / Venue">
                    <input required value={editingMatch?editingMatch.venue:mForm.venue} onChange={(e)=> (editingMatch ? setEditingMatch({...editingMatch, venue:e.target.value}) : setMForm({...mForm, venue:e.target.value}))} />
                  </Field>
                  <Field label="Status">
                    <select value={editingMatch?editingMatch.status:mForm.status} onChange={(e)=> (editingMatch ? setEditingMatch({...editingMatch, status:e.target.value}) : setMForm({...mForm, status:e.target.value}))}>
                      <option value="scheduled">Scheduled</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                    </select>
                  </Field>
                </Row>
                <div style={{ marginTop:10, display:"flex", gap:8 }}>
                  {!editingMatch && <button type="submit" className="sl-view-btn">Create Match ({genderTab})</button>}
                  {editingMatch && (
                    <>
                      <button type="button" className="sl-view-btn" onClick={saveMatch}>Save Changes</button>
                      <button type="button" className="sl-logout" onClick={()=>setEditingMatch(null)}>Cancel</button>
                    </>
                  )}
                </div>
              </form>
            </div>

            {/* Lists */}
            <div className="sl-card" style={{ padding:14, marginBottom:12 }}>
              <div style={{ fontWeight:700, color:"#174d2a", marginBottom:8 }}>Scheduled</div>
              <div style={{ display:"grid", gap:10 }}>
                {scheduled.map(m=>(
                  <div key={m.id} className="sl-card" style={{ padding:12, display:"grid", gap:6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontWeight:700 }}>{fmtDate(m.date)} — {m.gender==="men"?"Men":"Women"} vs {m.opponent}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="sl-navlink" onClick={()=>setEditingMatch({...m})}>Edit</button>
                        <button className="sl-logout" onClick={()=>removeMatch(m.id)} style={{ borderColor:"#f3c1c1" }}>Delete</button>
                        <button className="sl-view-btn" onClick={()=>doStart(m.id)}>Start</button>
                      </div>
                    </div>
                    <div style={{ color:"#4f6475" }}>{m.venue ? m.venue : ""}</div>
                  </div>
                ))}
                {!scheduled.length && <div style={{ color:"#4f6475" }}>No scheduled matches.</div>}
              </div>
            </div>

            <div className="sl-card" style={{ padding:14 }}>
              <div style={{ fontWeight:700, color:"#174d2a", marginBottom:8 }}>Completed</div>
              <div style={{ display:"grid", gap:10 }}>
                {completed.map(m=>(
                  <div key={m.id} className="sl-card" style={{ padding:12, display:"grid", gap:6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontWeight:700 }}>{fmtDate(m.date)} — {m.gender==="men"?"Men":"Women"} vs {m.opponent}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="sl-navlink" onClick={()=>setEditingMatch({...m})}>Edit</button>
                        <button className="sl-logout" onClick={()=>removeMatch(m.id)} style={{ borderColor:"#f3c1c1" }}>Delete</button>
                      </div>
                    </div>
                    <div style={{ color:"#4f6475" }}>{m.venue ? m.venue : ""}</div>
                  </div>
                ))}
                {!completed.length && <div style={{ color:"#4f6475" }}>No completed matches.</div>}
              </div>
            </div>
          </>
        )}

        {/* ---------------- PLAYERS ---------------- */}
        {tab==="players" && (
          <>
            {/* add/edit */}
            <div className="sl-card" style={{ padding:14, marginBottom:12 }}>
              <div style={{ fontWeight:700, color:"#174d2a", marginBottom:8 }}>{editingPlayer ? "Edit Player" : "Add Player"}</div>
              <form onSubmit={addPlayer}>
                <Row>
                  <Field label="Name">
                    <input required value={editingPlayer?editingPlayer.name:pForm.name} onChange={(e)=> (editingPlayer ? setEditingPlayer({...editingPlayer, name:e.target.value}) : setPForm({...pForm, name:e.target.value}))} />
                  </Field>
                  <Field label="Gender">
                    <select value={editingPlayer?editingPlayer.gender:pForm.gender} onChange={(e)=> (editingPlayer ? setEditingPlayer({...editingPlayer, gender:e.target.value}) : setPForm({...pForm, gender:e.target.value}))}>
                      <option value="men">Men</option>
                      <option value="women">Women</option>
                    </select>
                  </Field>
                </Row>
                <Row>
                  <Field label="Year">
                    <input value={editingPlayer?editingPlayer.year:pForm.year} onChange={(e)=> (editingPlayer ? setEditingPlayer({...editingPlayer, year:e.target.value}) : setPForm({...pForm, year:e.target.value}))} placeholder="Freshman / Sophomore / Junior / Senior" />
                  </Field>
                  <Field label="Hand">
                    <input value={editingPlayer?editingPlayer.hand:pForm.hand} onChange={(e)=> (editingPlayer ? setEditingPlayer({...editingPlayer, hand:e.target.value}) : setPForm({...pForm, hand:e.target.value}))} placeholder="R / L" />
                  </Field>
                </Row>
                <div style={{ marginTop:10, display:"flex", gap:8 }}>
                  {!editingPlayer && <button type="submit" className="sl-view-btn">Add Player</button>}
                  {editingPlayer && (
                    <>
                      <button type="button" className="sl-view-btn" onClick={savePlayer}>Save Changes</button>
                      <button type="button" className="sl-logout" onClick={()=>setEditingPlayer(null)}>Cancel</button>
                    </>
                  )}
                </div>
              </form>
            </div>

            {/* list */}
            <div className="sl-card" style={{ padding:14 }}>
              <div style={{ fontWeight:700, color:"#174d2a", marginBottom:8 }}>Players</div>
              <div style={{ display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))" }}>
                {players.map(p=>(
                  <div key={p.id} className="sl-card" style={{ padding:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontWeight:700 }}>{p.name}</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="sl-navlink" onClick={()=>setEditingPlayer({...p})}>Edit</button>
                        <button className="sl-logout" onClick={()=>removePlayer(p.id)} style={{ borderColor:"#f3c1c1" }}>Delete</button>
                      </div>
                    </div>
                    <div style={{ color:"#4f6475", marginTop:2 }}>
                      {p.gender==="men"?"Men":"Women"} • {p.year || "—"} {p.hand ? `• ${p.hand}` : ""}
                    </div>
                  </div>
                ))}
                {!players.length && <div style={{ color:"#4f6475" }}>No players yet.</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
