import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useGameContext } from './game/context'

import SpotifyLoginScreen from './pages/Roles/MusicHost/LoginScreen'
import Join from './pages/Join'
import SpotifyLoginCallback from './pages/Roles/MusicHost/LoginCallback'
import Settings from './pages/Roles/GameHost/Settings'
import HostGame from './pages/Roles/GameHost/HostGame'
import { Player } from './pages/Types/Player/Player'
import PlayerLobby from './pages/PlayerLobby'


function Welcome() {
  const { setIsHost } = useGameContext();
  const navigate = useNavigate();
  
  const hostAGameClickHandler = () => {
    setIsHost(true);
    navigate('/settings');
  };
  
  const joinAGameClickHandler = () => {
    setIsHost(false);
    navigate('/join');
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="hero">
        <div className="hero-content flex-col">
          <h1 className="text-5xl font-bold text-primary mb-4">GuessTheSong</h1>
          <p className="mb-6 text-lg text-base-content">
            Play a fun music guessing game with friends!
          </p>
          <div className="flex gap-4">
            <button
              onClick={hostAGameClickHandler}
              className="btn btn-primary btn-lg"
            >
              Host a Game
            </button>
            <button
              onClick={joinAGameClickHandler}
              className="btn btn-success btn-lg"
            >
              Join a Game
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/join" element={<Join />} />
        <Route path="/lobby" element={<PlayerLobby />} />
        <Route path="/spotifylogin" element={<SpotifyLoginScreen />} />
        <Route path="/spotifycallback" element={<SpotifyLoginCallback />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/hostgame" element={<HostGame />} />
        <Route path="/play" element={<Player />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}
