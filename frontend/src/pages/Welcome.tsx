import appConfig from '@app-config';
import { Navigate, Route, BrowserRouter as Router, Routes, useNavigate } from 'react-router-dom';
import { useGameContext } from '../game/context';
import Join from './player/Join';
import PlayerLobby from './player/Lobby';
import Game from './player/Game';
import HostGame from './host/Game';
import Settings from './host/Lobby';
import SpotifyCallback from './host/SpotifyCallback';

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
          <h1 className="text-5xl font-bold text-primary mb-4">{appConfig.displayName}</h1>
          <p className="mb-6 text-lg text-base-content">{appConfig.description}</p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={hostAGameClickHandler}
              className="btn btn-primary btn-lg"
            >
              Host a Game
            </button>
            <button
              type="button"
              onClick={joinAGameClickHandler}
              className="btn btn-success btn-lg"
            >
              Join a Game
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/join" element={<Join />} />
        <Route path="/lobby" element={<PlayerLobby />} />
        <Route path="/spotifycallback" element={<SpotifyCallback />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/hostgame" element={<HostGame />} />
        <Route path="/play" element={<Game />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
