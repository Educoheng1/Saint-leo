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
function ensureSets(v) {
  if (Array.isArray(v)) return v.map(s => [Number(s?.[0]||0), Number(s?.[1]||0)]);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map(p => p.trim().split("-").map(n => Number(n||0)));
  }
  return [[0,0]]; // default one empty set
}

/* ---------------- data loaders (players / schedule / live) ---------------- */
function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const bg =
    s === "completed" ? "#f0f9f0" :
    s === "live" ? "#e9f7ef" :
    "#f6f7fb";
  const clr =
    s === "completed" ? "#174d2a" :
    s === "live" ? "#1f7a4c" :
    "#485a6a";
  return (
    <span style={{
      background:bg, color:clr, padding:"6px 10px",
      borderRadius:999, fontWeight:700, fontSize:12, textTransform:"capitalize"
    }}>
      {s || "scheduled"}
    </span>
  );
}

function EditLineModal({ open, onClose, value, onChange, onSave }) {
  const [winner, setWinner] = React.useState("unfinished"); // "team" | "opponent" | "unfinished"
  React.useEffect(() => {
    if (open) setWinner(value?.winner ?? "unfinished");
  }, [open, value?.winner]);

  if (!open) return null;
  const r = value || {};
  const isScheduled = String(r.status || "").toLowerCase() === "scheduled";
  const isDoubles  = String(r.match_type || "").toLowerCase() === "doubles";
  const isLive = String(r.status || "").toLowerCase() === "live";
 


  const canStart = () => {
    if (!r.player1 || !r.opponent1) return false;
    if (isDoubles && (!r.player2 || !r.opponent2)) return false;
    return true;
  };

  const handlePrimary = async () => {
    if (isScheduled) {
      if (!canStart()) {
        alert(isDoubles
          ? "Please enter player1, player2, opponent1, and opponent2."
          : "Please enter player1 and opponent1.");
        return;
      }
      const body = {
        player1: r.player1,
        opponent1: r.opponent1,
        current_serve: Number(r.current_serve ?? 0),
      };
      if (isDoubles) {
        body.player2   = r.player2;
        body.opponent2 = r.opponent2;
      }
      const res = await startScoreLine(r.id, body);
      if (res?.score) {
        onChange(res.score); // refresh local draft with server copy
        onClose();           // close modal; card will reflect LIVE state
      }
    } else {
      await onSave(); // save scores via PUT /scores/{id}
    }
  };
  async function handleComplete() {
    const res = await completeScoreLine(r.id, winner);
    if (res?.score) {
      onChange(res.score);  // refresh row in UI
      onClose();            // close modal
    }
  }
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.25)",
      display:"grid", placeItems:"center", zIndex:1000
    }}>
      <div className="sl-card" style={{ width:640, padding:16, background:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontWeight:800, color:"#174d2a" }}>
            {isScheduled ? "Start Line" : "Edit Score"}
          </div>
          <button className="sl-logout" onClick={onClose}>Close</button>
        </div>

        <div style={{ display:"grid", gap:10 }}>
          <Row>
            <Field label="Type">
              <select
                value={r.match_type||"singles"}
                onChange={(e)=>onChange({match_type:e.target.value})}
                disabled={!isScheduled}  // lock after live
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
              </select>
            </Field>
            <Field label="Line #">
              <input
                type="number" min="1"
                value={r.line_no||1}
                onChange={(e)=>onChange({line_no:Number(e.target.value)})}
                disabled={!isScheduled}  // lock after live
              />
            </Field>
          </Row>

          <Row>
            <Field label="Team Player(s)">
              <input
                value={isDoubles
                  ? `${r.player1||""}${r.player2?` & ${r.player2}`:""}`
                  : (r.player1||"")}
                onChange={(e)=>{
                  const txt = e.target.value;
                  if (isDoubles && txt.includes("&")) {
                    const [p1,p2] = txt.split("&").map(s=>s.trim());
                    onChange({player1:p1, player2:p2});
                  } else {
                    onChange({player1:txt, player2: isDoubles ? (r.player2||"") : ""});
                  }
                }}
                placeholder={isDoubles?"John & Jack":"John"}
                disabled={!isScheduled} // lock after live
              />
            </Field>
            <Field label="Opponent(s)">
              <input
                value={isDoubles
                  ? `${r.opponent1||""}${r.opponent2?` & ${r.opponent2}`:""}`
                  : (r.opponent1||"")}
                onChange={(e)=>{
                  const txt = e.target.value;
                  if (isDoubles && txt.includes("&")) {
                    const [o1,o2] = txt.split("&").map(s=>s.trim());
                    onChange({opponent1:o1, opponent2:o2});
                  } else {
                    onChange({opponent1:txt, opponent2: isDoubles ? (r.opponent2||"") : ""});
                  }
                }}
                placeholder={isDoubles?"Opp A & Opp B":"Opp A"}
                disabled={!isScheduled} // lock after live
              />
            </Field>
          </Row>

          {/* Serve is allowed in both states */}
          <Row>
            <Field label="Serve">
              <select
                value={Number(r.current_serve ?? 0)}
                onChange={(e)=>onChange({current_serve:Number(e.target.value)})}
              >
                <option value={0}>Team</option>
                <option value={1}>Opponent</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={r.status || (isScheduled ? "scheduled" : "live")}
                onChange={(e)=>onChange({status:e.target.value})}
                disabled // control by backend actions
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </Row>

          {/* Sets editor only when LIVE */}
          {!isScheduled && (
            <Row>
              <Field label="Sets">
                <SetsEditor
                  value={r.sets ?? ensureSets(r.setsText)}
                  onChange={(next)=>onChange({ sets: next, setsText: undefined })}
                  labelLeft="Team"
                  labelRight="Opp"
                />
              </Field>
            </Row>
          )}
   {isLive && (
          <Row>
            <Field label="Complete line">
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <select
                  value={winner}
                  onChange={(e)=>setWinner(e.target.value)}
                  className="sl-input"
                  style={{ padding:"6px 10px" }}
                >
                  <option value="unfinished">Unfinished</option>
                  <option value="team">Team Won</option>
                  <option value="opponent">Opponent Won</option>
                </select>
                <button className="sl-logout" onClick={handleComplete}>
                  Complete Line
                </button>
              </div>
            </Field>
          </Row>
        )}
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            <button className="sl-view-btn" onClick={handlePrimary}>
              {isScheduled ? "Start Line" : "Save Score"}
            </button>
            <button className="sl-logout" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}


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
  console.log("Starting match with ID:", id);
  const body = { status: "live", started: 1 };
  try {
    const response = await fetch(`${API_BASE_URL}/schedule/${id}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    console.log("Start match response:", data);
    if (!response.ok) {
      throw new Error(data.detail || "Failed to start match");
    }
    return true;
  } catch (error) {
    console.error("Error starting match:", error);
    return false;
  }
}
function normalizeSets(sets = [], N = 3) {
  const s = (sets || []).map(x => {
    if (Array.isArray(x)) return { team: Number(x[0] ?? 0), opp: Number(x[1] ?? 0) };
    return {
      team: Number(x?.team ?? x?.a ?? x?.team_score ?? 0),
      opp:  Number(x?.opp  ?? x?.b ?? x?.opp_score  ?? 0),
    };
  });
  while (s.length < N) s.push({ team: 0, opp: 0 });
  return s.slice(0, N);
}
async function endMatch(matchId) {
  // Ask the admin who won
  const winner = window.prompt(
    "Who won this match? Type 'team' for Saint Leo or 'opponent' for the other team:"
  );

  // If they canceled or typed something weird, just stop
  if (!winner || !["team", "opponent"].includes(winner.trim().toLowerCase())) {
    console.error("Invalid winner choice:", winner);
    alert("Match not ended. Please type exactly: team  or  opponent.");
    return;
  }

  const cleanWinner = winner.trim().toLowerCase();

  try {
    const res = await fetch(`${API_BASE_URL}/schedule/${matchId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ winner: cleanWinner }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("endMatch failed", res.status, text);
      alert("Failed to end match: " + res.status);
      return;
    }

    const data = await res.json();
    console.log("Match completed:", data);
    alert(`Match ended. Winner: ${cleanWinner === "team" ? "Saint Leo" : "Other team"}`);

    // optional: refresh UI after ending
    // reload live match / clear it
    // e.g. setLiveMatch(null); setHasLive(false); setLines([]);
  } catch (err) {
    console.error("endMatch error", err);
    alert("Network error ending match.");
  }
}

async function startScoreLine(scoreId, body) {
  try {
    const r = await fetch(`${API_BASE_URL}/scores/${scoreId}/start`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json(); // { message, score }
  } catch (err) {
    console.error("startScoreLine error:", err);
    alert("Error starting line: " + (err.message || "unknown"));
    return null;
  }
}
// Scores
async function saveScoreLine(matchId, row) {
  if (!row?.id) {
    alert("Cannot save score: missing line id");
    return null;
  }
  const payload = {
    // send only scoring fields; backend coerces sets string or array
    sets: Array.isArray(row.sets) ? row.sets : stringToSets(row.setsText),
    // keep these if you want them mutable while live:
    current_game: row.current_game || [0, 0],
    status: row.status || "live",
    current_serve: String(row.current_serve ?? 0),
    winner: row.winner ?? null,
  };
  try {
    const r = await fetch(`${API_BASE_URL}/scores/${row.id}`, {
      method: "PUT",
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
async function completeScoreLine(scoreId, winner /* "team" | "opponent" | "unfinished" */) {
  try {
    const r = await fetch(`${API_BASE_URL}/scores/${scoreId}/complete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ winner }),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json(); // { message, score }
  } catch (err) {
    console.error("completeScoreLine error:", err);
    alert("Error completing line: " + (err.message || "unknown"));
    return null;
  }
}

function NumStepper({ value, onChange, min=0, max=99, ariaLabel }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <button className="sl-logout" onClick={() => onChange(Math.max(min, value-1))} aria-label={`${ariaLabel} minus`}>−</button>
      <div style={{ minWidth:28, textAlign:"center", fontWeight:700 }}>{value}</div>
      <button className="sl-view-btn" onClick={() => onChange(Math.min(max, value+1))} aria-label={`${ariaLabel} plus`}>+</button>
    </div>
  );
}

/**
 * value can be:
 *   [team, opp]  -> normal game (any integers)
 *   {mode:'tiebreak', score:[team, opp]} -> tiebreak (also integers)
 * We render the same numeric steppers for both; the shape is preserved.
 */
function GameEditor({ value, onChange, isTB=false }) {
  const score = isTB
    ? (value?.score ?? [0,0])
    : (Array.isArray(value) ? value : [0,0]);

  const setSide = (side, v) => {
    const nv = Math.max(0, Math.min(99, v));
    if (isTB) {
      const next = { mode:'tiebreak', score:[...score] };
      next.score[side] = nv;
      onChange(next);
    } else {
      const next = [...score];
      next[side] = nv;
      onChange(next);
    }
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      <div style={{ border:"1px solid #e6eef0", borderRadius:10, padding:8 }}>
        <div style={{ marginBottom:6, color:"#52707e" }}>Team</div>
        <NumStepper value={score[0]} onChange={(v)=>setSide(0,v)} ariaLabel="Team points" />
      </div>
      <div style={{ border:"1px solid #e6eef0", borderRadius:10, padding:8 }}>
        <div style={{ marginBottom:6, color:"#52707e" }}>Opp</div>
        <NumStepper value={score[1]} onChange={(v)=>setSide(1,v)} ariaLabel="Opponent points" />
      </div>
    </div>
  );
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
function AdminLineCard({ line, onEdit }) {
  // compute set totals to show big numbers like your card
  const rawSets = Array.isArray(line.sets) ? line.sets : stringToSets(line.setsText);
  // normalize to [a,b] pairs even if backend sent objects like {team, opp}
  const sets = rawSets
    .map(s => Array.isArray(s) ? s : [Number(s?.team ?? s?.home ?? 0), Number(s?.opp ?? s?.away ?? 0)])
    .filter(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n)));
  const teamSetsWon = sets.filter(p => (p[0] ?? 0) > (p[1] ?? 0)).length;
const oppSetsWon  = sets.filter(p => (p[1] ?? 0) > (p[0] ?? 0)).length;
  const cg = Array.isArray(line.current_game) ? line.current_game : [0, 0];
  const [cgA = 0, cgB = 0] = cg;
  
  const setsArr = Array.isArray(line.sets) ? line.sets : [];
  // If you store sets as text, normalize first:
  const setsFromText = typeof line.setsText === 'string'
    ? line.setsText.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const teamNames = (line.match_type==="doubles")
    ? `${line.player1||"Player 1"}\n${line.player2||"Player 2"}`
    : `${line.player1||"Player"}`;

  const oppNames = (line.match_type==="doubles")
    ? `${line.opponent1||"Opp 1"}\n${line.opponent2||"Opp 2"}`
    : `${line.opponent1||"Opponent"}`;

  return (
    <div className="sl-card" style={{ padding:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div style={{ fontWeight:800, color:"#174d2a" }}>
          {`Court ${line.line_no || 1} – ${line.match_type==="doubles" ? "Doubles" : "Singles"}`}
        </div>
        <StatusPill status={line.status} />
      </div>

      {(() => {
  const setCols = normalizeSets(line.sets, 3);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr repeat(3, auto)",
        gap: 12,
        alignItems: "center",
      }}
    >
      {/* team names */}
      <div
        style={{
          whiteSpace: "pre-line",
          padding: "10px 12px",
          background: "#f7fff9",
          borderRadius: 12,
          border: "1px solid #e6f2e7",
          fontWeight: 700,
          color: "#1f3b2b",
        }}
      >
        {teamNames}
      </div>
      {setCols.map((s, i) => (
        <div key={`t${i}`} style={{ fontSize: 24, fontWeight: 800, textAlign: "center" }}>
          {s.team}
        </div>
      ))}

      {/* opponent row */}
      <div style={{ color: "#4f6475", whiteSpace: "pre-line" }}>{oppNames}</div>
      {setCols.map((s, i) => (
        <div key={`o${i}`} style={{ fontSize: 24, fontWeight: 800, textAlign: "center" }}>
          {s.opp}
        </div>
      ))}
    </div>
  );
})()}


      <div style={{ marginTop:12 }}>
        <button className="sl-navlink" onClick={onEdit}>
          Edit Match
        </button>
      </div>
    </div>
  );
}
function Stepper({ value, onChange, min=0, max=99, ariaLabel }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <button className="sl-logout" onClick={() => onChange(Math.max(min, value-1))} aria-label={`${ariaLabel} minus`}>−</button>
      <div style={{ minWidth:24, textAlign:"center", fontWeight:700 }}>{value}</div>
      <button className="sl-view-btn" onClick={() => onChange(Math.min(max, value+1))} aria-label={`${ariaLabel} plus`}>+</button>
    </div>
  );
}

function SetsEditor({ value, onChange, labelLeft="Team", labelRight="Opp" }) {
  const sets = ensureSets(value);

  const updateSet = (idx, side, val) => {
    const next = sets.map((s,i)=> i===idx ? [side===0?val:s[0], side===1?val:s[1]] : s);
    onChange(next);
  };

  const addSet = () => onChange([...sets, [0,0]]);
  const removeSet = () => onChange(sets.length>1 ? sets.slice(0,-1) : [[0,0]]);

  return (
    <div style={{ display:"grid", gap:10 }}>
      {sets.map((s, idx) => (
        <div key={idx} style={{
          display:"grid",
          gridTemplateColumns:"1fr auto 1fr",
          alignItems:"center",
          gap:12,
          padding:"8px 10px",
          border:"1px solid #e6eef0",
          borderRadius:10
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:"#52707e" }}>{labelLeft}</span>
            <Stepper
              value={s[0]} ariaLabel={`Set ${idx+1} ${labelLeft}`}
              onChange={(v)=>updateSet(idx, 0, v)}
            />
          </div>
          <div style={{ textAlign:"center", color:"#78909C", fontWeight:700 }}>Set {idx+1}</div>
          <div style={{ display:"flex", justifyContent:"end", alignItems:"center", gap:8 }}>
            <span style={{ color:"#52707e" }}>{labelRight}</span>
            <Stepper
              value={s[1]} ariaLabel={`Set ${idx+1} ${labelRight}`}
              onChange={(v)=>updateSet(idx, 1, v)}
            />
          </div>
        </div>
      ))}

      <div style={{ display:"flex", gap:8 }}>
        <button className="sl-navlink" onClick={addSet}>Add Set</button>
        <button className="sl-logout" onClick={removeSet}>Remove Set</button>
      </div>
    </div>
  );
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
  // add to Admin() component state:
const [editingIdx, setEditingIdx] = useState(null);
const [draftLine, setDraftLine] = useState(null);
// helper to open/close
const openEdit = (idx) => {
  const src = lines[idx];
  setEditingIdx(idx);
  setDraftLine({
    ...src,
    sets: ensureSets(src.sets ?? src.setsText),
  });
};
const isSixSix = (sets=[]) => {
  const last = (Array.isArray(sets) && sets.length) ? sets[sets.length-1] : [0,0];
  return Number(last?.[0]) === 6 && Number(last?.[1]) === 6;
};


const closeEdit = () => { setEditingIdx(null); setDraftLine(null); };
const commitEdit = async () => {
  const payload = { ...draftLine, sets: ensureSets(draftLine.sets) };
  const res = await saveScoreLine(liveMatch.id, payload);
  if (res) { setLines(await loadScores(liveMatch.id)); closeEdit(); }
  else alert("Failed to save line");
};

  /* ----- boot ----- */
  useEffect(() => {
    let mounted = true;
  
    async function tick() {
      try {
        const lm = await loadLive();
  
        if (!mounted) return;
  
        setHasLive(Boolean(lm));
  
        // only update liveMatch if it actually changed
        setLiveMatch(prev => {
          const same = JSON.stringify(prev) === JSON.stringify(lm);
          return same ? prev : lm;
        });
  
        if (lm?.id) {
          const newLines = await loadScores(lm.id);
          if (!mounted) return;
  
          // only update lines if it actually changed
          setLines(prev => {
            const same = JSON.stringify(prev) === JSON.stringify(newLines);
            return same ? prev : newLines;
          });
        }
      } catch (err) {
        console.error("poll error", err);
      }
    }
  
    // run once immediately so the UI isn't empty for 8s
    tick();
  
    const t = setInterval(tick, 8000);
  
    return () => {
      mounted = false;
      clearInterval(t);
    };
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
                  {liveMatch && <button
  onClick={() => endMatch(liveMatch.id)}
  className="btn btn-danger"
>
  End Match
</button>}
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

    <div style={{ display:"grid", gap:12 }}>
      {lines.map((r, idx) => (
        <AdminLineCard key={r.id || `new-${idx}`} line={r} onEdit={() => openEdit(idx)} />
      ))}
      {!lines.length && <div style={{ color:"#4f6475" }}>No lines yet — add one above.</div>}
    </div>

    <EditLineModal
      open={editingIdx !== null}
      value={draftLine || {}}
      onClose={closeEdit}
      onChange={(patch)=>setDraftLine(prev=>({ ...prev, ...patch }))}
      onSave={commitEdit}
    />
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
