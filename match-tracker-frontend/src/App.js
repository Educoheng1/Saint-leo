import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Schedule } from "./components/Schedule";
import PlayerList from "./components/PlayerList";
import LiveScore from "./components/LiveScore";
import Home from './components/Home';
import Admin from "./Admin";
import RoleSelector from "./components/RoleSelector";
import { AdminProvider, useAdmin } from './AdminContext'; // NEW

function AppContent() {
  const [roleSelected, setRoleSelected] = useState(false);
  const { setIsAdmin } = useAdmin();

  if (!roleSelected) {
    return (
      <RoleSelector
        onSelect={(role) => {
          setIsAdmin(role === 'admin');
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
