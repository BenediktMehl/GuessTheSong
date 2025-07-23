const localDevBaseUrl = 'http://127.0.0.1:5173'
const redirectUri = '/spotifycallback'
let clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

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

const getToken = async (code: string) => {
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error("Code verifier not found in localStorage");
        return;
    }

    if (!clientId) {
        console.error("VITE_SPOTIFY_CLIENT_ID is not defined in .env file or not loaded by Vite");
        return
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
            redirect_uri: localDevBaseUrl + redirectUri,
            code_verifier: codeVerifier,
        }),
    }

    const body = await fetch(url, payload);
    const response = await body.json();

    const expires_in_s = Number(response.expires_in)
    const expires_at = Number(Date.now()) + expires_in_s * 1000
    localStorage.setItem('expires_at', expires_at.toString());
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
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
        await getToken(code);
    }

    console.log("Spotify login successful, redirecting to host page...");
    const isLoggedIn = await spotifyIsLoggedIn();
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

    const expires_in_s = Number(response.expires_in)
    const expires_at = Number(Date.now()) + expires_in_s * 1000
    localStorage.setItem('expires_at', expires_at.toString());
    localStorage.setItem('access_token', response.access_token);
    if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token);
    }
}

export async function handleSpotifyLogin() {
    if (await spotifyIsLoggedIn()) {
        console.log("Already logged in with Spotify, redirecting to host page...");
        window.location.href = redirectUri
        return
    }

    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);

    if (!clientId) {
        console.error("VITE_SPOTIFY_CLIENT_ID is not defined in .env file or not loaded by Vite");
        return
    }
    // Log all available env keys for debugging
    console.log("Available import.meta.env keys:", Object.keys(import.meta.env));
    console.log("Using Spotify Client ID:", clientId);
    const scope = 'user-read-private user-read-email user-modify-playback-state user-read-playback-state';
    const authUrl = new URL("https://accounts.spotify.com/authorize")

    // generated in the previous step
    window.localStorage.setItem('code_verifier', codeVerifier);

    const params = {
        response_type: 'code',
        client_id: clientId,
        scope,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: localDevBaseUrl + redirectUri,
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
}

export async function spotifyIsLoggedIn(secondTry = false) {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || accessToken === 'undefined') {
        console.log("Not logged in with Spotify");
        return false;
    }

    const expiresAt = Number(localStorage.getItem('expires_at'))
    if (!expiresAt) {
        console.log("Expires at not found in localStorage");
        return false;
    }
    const timeEpsilon = 1000;
    if (expiresAt - Number(Date.now()) < timeEpsilon) {
        if (secondTry) {
            console.error("Spotify access token is expired or about to expire, but refresh failed.");
            return false;
        }
        console.log("Spotify access token is expired or about to expire: refreshing token...");
        await refreshToken()
        console.log("Token refreshed, checking if logged in again...");
        return spotifyIsLoggedIn(true);
    }

    console.log("Logged in with Spotify");
    return true;
}