import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// Placeholder pages for initial routing
import Host from './pages/Host'
import Join from './pages/Join'

function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <h1 className="text-4xl font-bold mb-6 text-blue-600 dark:text-blue-400">GuessTheSong</h1>
      <p className="space-x-4">
        <a
          href="/host"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          Host a Game
        </a>
        <a
          href="/join"
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
        >
          Join a Game
        </a>
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
