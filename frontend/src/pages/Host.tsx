import React from 'react'

export default function Host() {
  // Placeholder for Spotify login
  const handleSpotifyLogin = () => {
    // TODO: Implement Spotify OAuth flow
    alert('Spotify login flow will be implemented here.')
  }

  return (
    <main>
      <h2>Host Game</h2>
      <button onClick={handleSpotifyLogin}>
        Log in with Spotify
      </button>
      <p>After logging in, you will be able to create a game room and select a playlist.</p>
    </main>
  )
}