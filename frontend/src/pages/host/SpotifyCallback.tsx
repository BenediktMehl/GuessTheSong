import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/Card';
import { handleSpotifyLogin, handleSpotifyLoginCallback } from '../../services/spotify/auth';

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [isLoggedInSpotify, setIsLoggedInSpotify] = useState<boolean | null>(null);
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    handleSpotifyLoginCallback().then((isLoggedIn) => {
      console.log('Spotify login callback handled, isLoggedIn:', isLoggedIn);
      setIsLoggedInSpotify(isLoggedIn);
      if (isLoggedIn) {
        navigate('/settings', { replace: true });
      }
    });
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md" bodyClassName="items-center text-center gap-4">
        {isLoggedInSpotify ? (
          <p>Now redirecting to game</p>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-primary">Spotify Login not Successful</h2>
            <p className="text-error">Something went wrong. Please try logging in again.</p>
            <button
              type="button"
              className="btn btn-outline btn-success"
              onClick={handleSpotifyLogin}
            >
              Log in with Spotify
            </button>
          </>
        )}
      </Card>
    </main>
  );
}
