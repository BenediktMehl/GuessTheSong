import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');
    const state = urlParams.get('state');

    if (errorParam) {
      console.error('Spotify login error:', errorParam);
      setError(errorParam);
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    // Verify state
    const storedState = sessionStorage.getItem('spotify_state');
    if (!storedState || storedState !== state) {
      setError('State mismatch - possible CSRF attack');
      return;
    }

    // Get code verifier
    const codeVerifier = sessionStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      setError('Code verifier not found');
      return;
    }

    // Exchange code for token
    // Note: This requires a backend in production. For now, we'll show a message.
    // In a real implementation, you would make a POST request to your backend
    // which would exchange the code for tokens using the client secret.

    if (!SPOTIFY_CLIENT_ID) {
      setError('Spotify Client ID not configured. Token exchange requires a backend server.');
      return;
    }

    // For now, we'll just show that the callback was received
    // The actual token exchange should be done on a backend
    console.log('Authorization code received:', code);
    console.log('Note: Token exchange requires a backend server with client secret');

    // Clear stored values
    sessionStorage.removeItem('spotify_code_verifier');
    sessionStorage.removeItem('spotify_state');

    // Redirect back to settings
    setTimeout(() => {
      navigate('/settings', { replace: true });
    }, 2000);
  }, [navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md" bodyClassName="items-center text-center gap-4">
        {error ? (
          <>
            <h2 className="text-2xl font-semibold text-error">Spotify Login Error</h2>
            <p className="text-error">{error}</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/settings', { replace: true })}
            >
              Go Back
            </button>
          </>
        ) : (
          <>
            <p>Processing Spotify login...</p>
            <p className="text-sm text-base-content/70">
              Note: Token exchange requires a backend server. Please implement the token exchange
              endpoint.
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
