import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { BACKEND_HTTP_URL } from '../../config';
import { getRedirectUri } from '../../services/spotify/auth';
import logger from '../../utils/logger';

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Small delay to ensure localStorage is accessible
    const handleCallback = async () => {
      // Log all localStorage items for debugging
      const allLocalStorageKeys = Object.keys(localStorage);
      logger.debug('All localStorage items:', {
        spotify_state: localStorage.getItem('spotify_state'),
        spotify_code_verifier: localStorage.getItem('spotify_code_verifier')
          ? 'present'
          : 'missing',
        allKeys: allLocalStorageKeys,
        localStorageAvailable: typeof Storage !== 'undefined',
      });

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const errorParam = urlParams.get('error');
      const state = urlParams.get('state');

      logger.debug('Spotify callback received:', { code: !!code, errorParam, state });
      logger.debug('Current URL:', window.location.href);

      if (errorParam) {
        logger.error('Spotify login error:', errorParam);
        setError(errorParam);
        return;
      }

      if (!code) {
        setError('No authorization code received');
        return;
      }

      // Verify state - check both localStorage and sessionStorage for compatibility
      const storedState =
        localStorage.getItem('spotify_state') || sessionStorage.getItem('spotify_state');
      logger.debug('State verification:', {
        storedState,
        receivedState: state,
        match: storedState === state,
        localStorageState: localStorage.getItem('spotify_state'),
        sessionStorageState: sessionStorage.getItem('spotify_state'),
        localStorageLength: localStorage.length,
        sessionStorageLength: sessionStorage.length,
      });

      if (!storedState) {
        logger.error('State not found in storage. This might indicate:');
        logger.error('1. localStorage was cleared');
        logger.error('2. Browser privacy mode is blocking storage');
        logger.error('3. The redirect happened in a different context');
        setError(
          "State not found. This might be due to browser privacy settings or storage being cleared. Please try logging in again and ensure you're not in private/incognito mode."
        );
        return;
      }

      if (storedState !== state) {
        logger.error('State mismatch:', { stored: storedState, received: state });
        setError('State mismatch - possible CSRF attack. Please try logging in again.');
        // Clear stored values to allow retry
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_state');
        sessionStorage.removeItem('spotify_code_verifier');
        sessionStorage.removeItem('spotify_state');
        return;
      }

      // Get code verifier - check both storage locations
      const codeVerifier =
        localStorage.getItem('spotify_code_verifier') ||
        sessionStorage.getItem('spotify_code_verifier');
      if (!codeVerifier) {
        setError('Code verifier not found. Please try logging in again.');
        return;
      }

      // Exchange code for token via backend (keeps client secret secure)
      try {
        const redirectUri = getRedirectUri();
        const response = await fetch(`${BACKEND_HTTP_URL}/api/spotify/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          logger.error('Token exchange failed:', errorData);
          setError(
            `Token exchange failed: ${errorData.error || 'Unknown error'}. Make sure the backend is running and has SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET configured.`
          );
          return;
        }

        const tokenData = await response.json();

        // Store tokens in localStorage
        localStorage.setItem('access_token', tokenData.access_token);
        if (tokenData.refresh_token) {
          localStorage.setItem('refresh_token', tokenData.refresh_token);
        }
        if (tokenData.expires_in) {
          const expiresAt = Date.now() + tokenData.expires_in * 1000;
          localStorage.setItem('access_token_expires_at', expiresAt.toString());
        }

        logger.info('Token exchange successful');

        // Clear stored values from both storage locations
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_state');
        sessionStorage.removeItem('spotify_code_verifier');
        sessionStorage.removeItem('spotify_state');

        // Redirect back to host lobby
        navigate('/host-lobby', { replace: true });
      } catch (error) {
        logger.error('Token exchange error:', error);
        setError(
          `Failed to exchange token: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure the backend is running.`
        );
      }
    };

    // Small delay to ensure everything is loaded
    const timeoutId = setTimeout(handleCallback, 100);

    return () => clearTimeout(timeoutId);
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
              onClick={() => navigate('/host-lobby', { replace: true })}
            >
              Go Back
            </button>
          </>
        ) : (
          <>
            <p>Processing Spotify login...</p>
            <span className="loading loading-spinner loading-md"></span>
          </>
        )}
      </Card>
    </main>
  );
}
