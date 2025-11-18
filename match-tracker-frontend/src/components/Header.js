// src/components/Header.js
import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import LoginModal from "./LoginModal";

export default function Header() {
  const { user, logout, isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          borderBottom: "1px solid #ddd",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 20 }}>Saint Leo Match Tracker</div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {user && (
            <div style={{ fontSize: 14, color: "#555" }}>
              {user.email} {isAdmin ? "(admin)" : ""}
            </div>
          )}

          {user ? (
            <button
              onClick={logout}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid #174d2a",
                background: "#174d2a",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Log in
            </button>
          )}
        </div>
      </header>

      {showModal && <LoginModal onClose={() => setShowModal(false)} />}
    </>
  );
}
