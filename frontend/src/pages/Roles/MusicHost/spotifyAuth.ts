import { loggedInToSpotify, loggedOutOfSpotify } from "../../../game/musicHost";
import { ws } from "../../../game/host";
import { initializePlayer, disconnectPlayer } from "./spotifyPlayer";

const FALLBACK_REDIRECT_BASE = 'http://127.0.0.1:5173';
const redirectPath = '/spotifycallback';
const DEFAULT_REDIRECT_BASE = typeof window !== 'undefined' ? window.location.origin : FALLBACK_REDIRECT_BASE;
const shouldUseFallbackBase = DEFAULT_REDIRECT_BASE.includes('localhost');

const redirectBaseUrl = (import.meta.env.VITE_SPOTIFY_REDIRECT_BASE as string | undefined)
    ?? (shouldUseFallbackBase ? FALLBACK_REDIRECT_BASE : DEFAULT_REDIRECT_BASE);
const redirectUri = `${redirectBaseUrl.replace(/\/$/, '')}${redirectPath}`;

// Load Spotify Client ID from environment variables
// Vite automatically loads .env.local, .env.development, .env files
// Priority: .env.local > .env.[mode].local > .env.[mode] > .env
let clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;

const generateRandomString = (length: number) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

const sha256 = async (plain: string) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return window.crypto.subtle.digest('SHA-256', data)
}


const base64encode = (input: ArrayBuffer | ArrayLike<number>) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Validates that the access token has the required scopes by making a test API call
 * Returns true if scopes are valid, false otherwise
 */
async function validateTokenScopes(accessToken: string): Promise<boolean> {
    try {
        // Make a test API call that requires user-modify-playback-state scope
        // We'll check if we can get the player devices (requires user-read-playback-state)
        // and if we can get user info (requires user-read-private)
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.warn('Token validation failed: authentication or scope issue');
                return false;
            }
        }

        // Try a more specific test - check if we can access player endpoints
        // This will fail if we don't have user-read-playback-state or user-modify-playback-state
        const playerResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        // 403 means forbidden (likely missing scopes), 401 means unauthorized
        if (playerResponse.status === 403) {
            console.warn('Token validation failed: missing required playback scopes');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating token scopes:', error);
        return false;
    }
}

const getToken = async (code: string) => {
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error("Code verifier not found in localStorage");
        return;
    }

    if (!clientId) {
        console.error("VITE_SPOTIFY_CLIENT_ID is not defined in .env.local file or not loaded by Vite");
        console.error("Available import.meta.env keys:", Object.keys(import.meta.env));
        console.error("Note: If you just created/updated .env.local, you need to restart the Vite dev server for changes to take effect.");
        return;
    }
    // Log all available env keys for debugging
    console.log("Available import.meta.env keys:", Object.keys(import.meta.env));
    console.log("Using Spotify Client ID:", clientId);

    const url = "https://accounts.spotify.com/api/token";
    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        }),
    }

    const body = await fetch(url, payload);
    const response = await body.json();

    if (response.error) {
        console.error("Error getting token:", response.error);
        return;
    }

    const expires_in_s = Number(response.expires_in)
    const expires_at = Number(Date.now()) + expires_in_s * 1000
    localStorage.setItem('expires_at', expires_at.toString());
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);

    // Validate token scopes after token exchange
    const scopesValid = await validateTokenScopes(response.access_token);
    if (!scopesValid) {
        console.error("Token does not have required scopes. Clearing tokens and requiring re-authentication.");
        // Clear tokens - user will need to re-authenticate
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('expires_at');
        throw new Error("Token scopes are invalid. Please re-authenticate with correct scopes.");
    }
}


export async function getSpotifyProfile() {
    const accessToken = localStorage.getItem('access_token');

    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
            Authorization: 'Bearer ' + accessToken
        }
    });

    return await response.json();
}


export async function handleSpotifyLoginCallback(): Promise<boolean> {
    console.log("Handling Spotify login callback...");

    if (await spotifyIsLoggedIn()) {
        console.log("Already logged in with Spotify...");
        if (ws && ws.readyState === WebSocket.OPEN) {
            loggedInToSpotify();
        }
        return true;
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        if (error) {
            console.error("Spotify login error:", error);
            return false;
        }


        let code = urlParams.get('code');
        if (!code) {
            console.error("No code found in URL");
            return false;
        }
        console.log("Received code:", code);
        try {
            await getToken(code);
        } catch (error) {
            console.error("Error during token exchange:", error);
            // Error is already logged in getToken, tokens are cleared
            return false;
        }
    }

    console.log("Spotify login successful, redirecting to host page...");
    const isLoggedIn = await spotifyIsLoggedIn();
    if (isLoggedIn && ws && ws.readyState === WebSocket.OPEN) {
        loggedInToSpotify();
        // Initialize the player after successful login
        initializePlayer().catch((error) => {
            console.error("Failed to initialize Spotify player:", error);
        });
    }
    return isLoggedIn
}

async function refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        console.error("No refresh token found in localStorage");
        return;
    }
    const url = "https://accounts.spotify.com/api/token";

    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId
        }),
    }
    const body = await fetch(url, payload);
    const response = await body.json();

    if (response.error) {
        console.error("Error refreshing token:", response.error);
        // If refresh fails, clear tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('expires_at');
        return;
    }

    const expires_in_s = Number(response.expires_in)
    const expires_at = Number(Date.now()) + expires_in_s * 1000
    localStorage.setItem('expires_at', expires_at.toString());
    localStorage.setItem('access_token', response.access_token);
    if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
    }

    // Note: Token refresh does NOT grant new scopes. If the original token had insufficient scopes,
    // the refreshed token will also have insufficient scopes. We validate this after refresh.
    const scopesValid = await validateTokenScopes(response.access_token);
    if (!scopesValid) {
        console.error("Refreshed token does not have required scopes. User must re-authenticate.");
        // Clear tokens - user will need to re-authenticate with correct scopes
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('expires_at');
        throw new Error("Refreshed token has insufficient scopes. Please re-authenticate.");
    }
}

export async function handleSpotifyLogin() {
    if (await spotifyIsLoggedIn()) {
        console.log("Already logged in with Spotify, redirecting to host page...");
    window.location.href = redirectPath
        return
    }

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);

    if (!clientId) {
        console.error("VITE_SPOTIFY_CLIENT_ID is not defined in .env.local file or not loaded by Vite");
        console.error("Available import.meta.env keys:", Object.keys(import.meta.env));
        console.error("Note: If you just created/updated .env.local, you need to restart the Vite dev server for changes to take effect.");
        return;
    }
    // Log all available env keys for debugging
    console.log("Available import.meta.env keys:", Object.keys(import.meta.env));
    console.log("Using Spotify Client ID:", clientId);
    const scope = 'user-read-private user-read-email user-modify-playback-state user-read-playback-state playlist-read-private playlist-read-collaborative streaming';
    const authUrl = new URL("https://accounts.spotify.com/authorize")

    // generated in the previous step
    window.localStorage.setItem('code_verifier', codeVerifier);

    const params = {
        response_type: 'code',
        client_id: clientId,
        scope,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    redirect_uri: redirectUri,
    }

    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
}

export function handleSpotifyLogout() {
    console.log("Logging out from Spotify...");
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('code_verifier');
    disconnectPlayer().catch((error) => {
        console.error("Error disconnecting player:", error);
    });
    loggedOutOfSpotify();
}

export async function spotifyIsLoggedIn(secondTry = false) {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || accessToken === 'undefined') {
        console.log("Not logged in with Spotify");
        loggedOutOfSpotify();
        return false;
    }

    const expiresAt = Number(localStorage.getItem('expires_at'));
    if (!expiresAt) {
        console.log("Expires at not found in localStorage");
        loggedOutOfSpotify();
        return false;
    }
    const timeEpsilon = 1000;
    if (expiresAt - Number(Date.now()) < timeEpsilon) {
        if (secondTry) {
            console.error("Spotify access token is expired or about to expire, but refresh failed.");
            loggedOutOfSpotify();
            return false;
        }
        console.log("Spotify access token is expired or about to expire: refreshing token...");
        try {
            await refreshToken();
            console.log("Token refreshed, checking if logged in again...");
            return spotifyIsLoggedIn(true);
        } catch (error) {
            console.error("Error refreshing token:", error);
            // Token refresh failed or scopes are invalid - user needs to re-authenticate
            loggedOutOfSpotify();
            return false;
        }
    }

    console.log("Logged in with Spotify");
    return true;
}