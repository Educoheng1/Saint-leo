import { useState,useEffect  } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Schedule } from "./components/Schedule";
import PlayerList from "./components/PlayerList";
import LiveScore from "./components/LiveScore";
import Home from './components/Home';
import Admin from "./Admin";
import RoleSelector from "./components/RoleSelector";
import { AdminProvider, useAdmin } from './AdminContext'; // NEW

function AppContent() {
  const [roleSelected, setRoleSelected] = useState(() => {
    return localStorage.getItem("roleSelected") === "true";
  });
  const { setIsAdmin } = useAdmin();

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    setIsAdmin(isAdmin);
  }, [setIsAdmin]);

  if (!roleSelected) {
    return (
      <RoleSelector
        onSelect={(role) => {
          const isAdmin = role === "admin";
          setIsAdmin(isAdmin);
          localStorage.setItem("isAdmin", isAdmin);
          localStorage.setItem("roleSelected", true);
          setRoleSelected(true);
        }}
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/players" element={<PlayerList />} />
      <Route path="/livescore" element={<LiveScore />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

function App() {
  return (
    <AdminProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AdminProvider>
  );
}

export default App;

