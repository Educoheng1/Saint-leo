// src/App.js
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Schedule from "./components/Schedule";
import PlayerList from "./components/PlayerList";
import LiveScore from "./components/LiveScore";
import Admin from "./Admin";
import BoxScorePage from "./components/BoxScorePage";
import Dashboard from "./components/Dashbord";

import Header from "./components/Header";
import { AuthProvider, useAuth } from "./AuthContext";

// This component holds the routes and uses auth state
function AppRoutes() {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    // while we restore auth from localStorage
    return <div style={{ padding: 16 }}>Loading...</div>;
  }

  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/players" element={<PlayerList />} />
        <Route path="/livescore" element={<LiveScore />} />
        <Route path="/boxscore/:id" element={<BoxScorePage />} />

        {/* Admin route: only admins can see this page on the frontend */}
        <Route
          path="/admin"
          element={isAdmin ? <Admin /> : <Navigate to="/" replace />}
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
