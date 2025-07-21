import React from 'react'
import { handleSpotifyLogin } from '../util/spotifyAuth'

export default function Host() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <h2 className="card-title text-2xl mb-2">Host Game</h2>
          <button
            className="btn btn-outline btn-success mb-4"
            onClick={handleSpotifyLogin}
          >
            Log in with Spotify
          </button>
          <p className="text-base-content">
            After logging in, you will be able to create a game room and select a playlist.
          </p>
        </div>
      </div>
    </main>
  )
}