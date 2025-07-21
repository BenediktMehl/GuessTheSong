import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

// Placeholder pages for initial routing
import Host from './pages/Host'
import Join from './pages/Join'

function Home() {
  return (
    <main>
      <h1>GuessTheSong</h1>
      <p>
        <a href="/host">Host a Game</a> | <a href="/join">Join a Game</a>
      </p>
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
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
