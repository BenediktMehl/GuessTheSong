import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Placeholder pages for initial routing
import SpotifyLoginScreen from './pages/Roles/MusicHost/LoginScreen'
import Join from './pages/Join'
import SpotifyLoginCallback from './pages/Roles/MusicHost/LoginCallback'
import Settings from './pages/Roles/GameHost/Settings'
import { spotifyIsLoggedIn } from './pages/Roles/MusicHost/spotifyAuth'
import HostGame from './pages/Roles/GameHost/HostGame'
import { Player } from './pages/Types/Player/Player'

function Home() {
  const hostAGameClickHandler = async () => {
      window.location.href = '/settings'
  }
  const joinAGameClickHandler = () => {
    window.location.href = '/join'
  }

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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join />} />
        <Route path="/spotifylogin" element={<SpotifyLoginScreen />} />
        <Route path="/spotifycallback" element={<SpotifyLoginCallback />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/hostgame" element={<HostGame />} />
        <Route path="*" element={<Navigate to="/" />} />
        <Route path="/play" element={<Player />} />
      </Routes>
    </Router>
  )
}

export default App
