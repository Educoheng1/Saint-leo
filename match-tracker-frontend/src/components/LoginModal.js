// src/components/LoginModal.js
import React, { useState } from "react";
import { useAuth } from "../AuthContext";

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://saint-leo-live-score.onrender.com";

export default function LoginModal({ onClose }) {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // "login" or "register"

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // NEW: first + last name for registration
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Login failed");
      }

      const data = await res.json();
      // data = { access_token, token_type, user: { id, email, role, ... } }
      login(data.access_token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          // no role here – backend will default to "user"
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Registration failed");
      }

      // after successful register, log in with same credentials
      await handleLogin(e);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 360,
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {mode === "login" ? "Sign in" : "Register"}
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: 999,
              border: "1px solid #174d2a",
              background: mode === "login" ? "#174d2a" : "#fff",
              color: mode === "login" ? "#fff" : "#174d2a",
              cursor: "pointer",
            }}
          >
            Login
          </button>
          <button
            onClick={() => setMode("register")}
            style={{
              flex: 1,
              padding: "6px 0",
              borderRadius: 999,
              border: "1px solid #174d2a",
              background: mode === "register" ? "#174d2a" : "#fff",
              color: mode === "register" ? "#fff" : "#174d2a",
              cursor: "pointer",
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
          {mode === "register" && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                  }}
                  required
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
              required
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
              required
            />
          </div>

          {/* admin checkbox REMOVED */}

          {error && (
            <div style={{ color: "red", fontSize: 13, marginBottom: 8 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 999,
              border: "none",
              background: "#174d2a",
              color: "#fff",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Log in"
              : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
