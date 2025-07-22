import React, { use, useEffect } from 'react'
import { handleSpotifyLogin, spotifyIsLoggedIn } from './spotifyAuth'

export default function SpotifyLoginScreen() {

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      if (await spotifyIsLoggedIn()) {
        window.location.href = '/menu'
      }
    }
    redirectIfLoggedIn()
  }, [])

  return (
    <main>
      <div className="z-10 min-h-screen flex items-center justify-center flex-col mx-4">
        <h2 className="text-2xl mb-2">Spotify Login</h2>
        <p className="mb-4 text-base-content text-center">
          You where assigned as spotify host. The music will be played through your Spotify account. You need a spotify premium account for that.
        </p>
        <button
          className="btn btn-success btn-lg mb-4"
          onClick={handleSpotifyLogin}
        >
          Log in with Spotify
        </button>
        <button
          className="btn btn-lg btn-error"
          onClick={() => window.location.href = '/'}
        >
          Reject and go back
        </button>
      </div>
    </main>
  )
}