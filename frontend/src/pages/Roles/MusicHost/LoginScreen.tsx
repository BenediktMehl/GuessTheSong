import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleSpotifyLogin, spotifyIsLoggedIn } from './spotifyAuth'

export default function SpotifyLoginScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      if (await spotifyIsLoggedIn()) {
        navigate('/menu')
      }
    }
    redirectIfLoggedIn()
  }, [navigate])

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
          onClick={() => navigate('/')}
        >
          Reject and go back
        </button>
      </div>
    </main>
  )
}