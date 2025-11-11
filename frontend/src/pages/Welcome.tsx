import appConfig from '@app-config';
import { Navigate, Route, BrowserRouter as Router, Routes, useNavigate } from 'react-router-dom';
import { BackendOffline } from '../components/BackendOffline';
import { useGameContext } from '../game/context';
import HostGame from './host/Game';
import HostLobby from './host/Lobby';
import SpotifyCallback from './host/SpotifyCallback';
import Game from './player/Game';
import Join from './player/Join';
import PlayerLobby from './player/Lobby';

function Welcome() {
  const { setIsHost, wsStatus } = useGameContext();
  const navigate = useNavigate();

  const hostAGameClickHandler = () => {
    setIsHost(true);
    navigate('/host-lobby');
  };

  const joinAGameClickHandler = () => {
    setIsHost(false);
    navigate('/join');
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-2 sm:p-4">
      <div className="hero">
        <div className="hero-content flex-col">
          {wsStatus === 'failed' && (
            <div className="mb-4 w-full max-w-md">
              <BackendOffline showButtons={false} />
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-2 sm:mb-4">
            {appConfig.displayName}
          </h1>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={hostAGameClickHandler}
              className="btn btn-primary btn-sm sm:btn-md md:btn-lg w-full sm:w-auto"
            >
              Host a Game
            </button>
            <button
              type="button"
              onClick={joinAGameClickHandler}
              className="btn btn-success btn-sm sm:btn-md md:btn-lg w-full sm:w-auto"
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
        <Route path="/host-lobby" element={<HostLobby />} />
        <Route path="/hostgame" element={<HostGame />} />
        <Route path="/play" element={<Game />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
