import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Placeholder pages for initial routing
import Host from './pages/Host'
import Join from './pages/Join'
import SpofiyLoginCallback from './pages/SpofiyLoginCallback'
import Menu from './pages/Menu'
import { spotifyIsLoggedIn } from './util/spotify'

function Home() {
  const hostAGameClickHandler = async () => {
    if(await spotifyIsLoggedIn()) {
      window.location.href = '/menu'
    } else {
      window.location.href = '/host'
    }
  }
  const joinAGameClickHandler = () => {
    window.location.href = '/join'
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-200">
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
        <Route path="/host" element={<Host />} />
        <Route path="/join" element={<Join />} />
        <Route path="/spotify_callback" element={<SpofiyLoginCallback />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
