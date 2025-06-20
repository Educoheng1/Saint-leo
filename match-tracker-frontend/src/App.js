import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Schedule } from "./components/Schedule";
import PlayerList from "./components/PlayerList";
import LiveScore from "./components/LiveScore";
import Home from './components/Home';
import Admin from "./Admin";



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/players" element={<PlayerList />} />
        <Route path="/livescore" element={<LiveScore />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
