// Simple Spotify OAuth client-side implementation
// Note: In production, you should use a backend for token exchange

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const REDIRECT_URI = `${window.location.origin}/spotifycallback`;

// Generate random string for state/verifier
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Generate code verifier for PKCE
function generateCodeVerifier(): string {
  return generateRandomString(128);
}

// Generate code challenge from verifier
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function handleSpotifyLogin(): Promise<void> {
  if (!SPOTIFY_CLIENT_ID) {
    console.error('Spotify Client ID not configured. Please set VITE_SPOTIFY_CLIENT_ID in your .env file');
    alert('Spotify integration is not configured. Please set VITE_SPOTIFY_CLIENT_ID in your environment variables.');
    return;
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);

  // Store verifier and state for later use
  sessionStorage.setItem('spotify_code_verifier', codeVerifier);
  sessionStorage.setItem('spotify_state', state);

  // Build authorization URL
  // Note: scope must be space-separated, URLSearchParams will encode it properly
  const scope = 'streaming user-read-email user-read-private';
  const params = new URLSearchParams();
  params.append('response_type', 'code');
  params.append('client_id', SPOTIFY_CLIENT_ID);
  params.append('scope', scope);
  params.append('redirect_uri', REDIRECT_URI);
  params.append('state', state);
  params.append('code_challenge_method', 'S256');
  params.append('code_challenge', codeChallenge);

  // Log the redirect URI for debugging
  console.log('Redirecting to Spotify with redirect_uri:', REDIRECT_URI);
  console.log('Make sure this URI is registered in your Spotify app settings:', REDIRECT_URI);

  // Redirect to Spotify authorization
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function spotifyIsLoggedIn(): boolean {
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  // Check if token is expired (basic check - tokens typically expire in 3600 seconds)
  const expiresAt = localStorage.getItem('access_token_expires_at');
  if (expiresAt) {
    const expiryTime = parseInt(expiresAt, 10);
    if (Date.now() > expiryTime) {
      // Token expired
      localStorage.removeItem('access_token');
      localStorage.removeItem('access_token_expires_at');
      localStorage.removeItem('refresh_token');
      return false;
    }
  }

  return true;
}

export function logoutSpotify(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('access_token_expires_at');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('spotify_username');
}

export async function getSpotifyUsername(): Promise<string | null> {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  // Check if we have a cached username
  const cachedUsername = localStorage.getItem('spotify_username');
  if (cachedUsername) return cachedUsername;

  try {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        logoutSpotify();
      }
      return null;
    }

    const data = await response.json();
    const username = data.display_name || data.id || null;
    
    if (username) {
      localStorage.setItem('spotify_username', username);
    }
    
    return username;
  } catch (error) {
    console.error('Failed to fetch Spotify username:', error);
    return null;
  }
}

