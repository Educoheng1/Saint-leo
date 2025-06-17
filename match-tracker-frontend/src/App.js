import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Schedule } from "./components/Schedule";
import PlayerList from "./components/PlayerList";
import LiveScore from "./components/LiveScore";
import Home from './components/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/players" element={<PlayerList />} />
        <Route path="/livescore" element={<LiveScore />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
