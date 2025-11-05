import { spotifyIsLoggedIn, handleSpotifyLogout } from './spotifyAuth';

let player: Spotify.Player | null = null;
let deviceId: string | null = null;
let isPlayerReady = false;
let playerState: Spotify.PlaybackState | null = null;
let stateChangeCallbacks: Array<(state: Spotify.PlaybackState | null) => void> = [];
let readyCallbacks: Array<(ready: boolean) => void> = [];
let authenticationErrorCallbacks: Array<(message: string) => void> = [];

declare global {
  interface Window {
    Spotify: typeof Spotify;
    onSpotifyWebPlaybackSDKReady: (() => void) | null;
  }
}

function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

async function ensureSpotifySDKLoaded(): Promise<boolean> {
  if (window.Spotify) {
    return true;
  }

  return new Promise((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    if (existingScript) {
      if (window.onSpotifyWebPlaybackSDKReady) {
        const originalCallback = window.onSpotifyWebPlaybackSDKReady;
        window.onSpotifyWebPlaybackSDKReady = () => {
          if (originalCallback) originalCallback();
          resolve(true);
        };
      } else {
        window.onSpotifyWebPlaybackSDKReady = () => {
          resolve(true);
        };
      }
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve(true);
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    script.onerror = () => {
      console.error('Failed to load Spotify SDK');
      window.onSpotifyWebPlaybackSDKReady = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export async function initializePlayer(): Promise<boolean> {
  if (player) {
    return isPlayerReady;
  }

  const isLoggedIn = await spotifyIsLoggedIn();
  if (!isLoggedIn) {
    console.error('Cannot initialize player: user is not logged in');
    return false;
  }

  const sdkLoaded = await ensureSpotifySDKLoaded();
  if (!sdkLoaded) {
    console.error('Spotify SDK not loaded');
    return false;
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    console.error('No access token available');
    return false;
  }

  try {
    player = new window.Spotify.Player({
      name: 'Guess The Song',
      getOAuthToken: (callback) => {
        const token = getAccessToken();
        if (token) {
          callback(token);
        } else {
          console.error('No access token available for player');
        }
      },
      volume: 0.5,
    });

    player.addListener('ready', ({ device_id }) => {
      console.log('Spotify player is ready with device ID:', device_id);
      deviceId = device_id;
      isPlayerReady = true;
      readyCallbacks.forEach((callback) => {
        callback(true);
      });
    });

    player.addListener('not_ready', ({ device_id }) => {
      console.log('Spotify player is not ready. Device ID:', device_id);
      isPlayerReady = false;
      readyCallbacks.forEach((callback) => {
        callback(false);
      });
    });

    player.addListener('player_state_changed', (state) => {
      playerState = state;
      stateChangeCallbacks.forEach((callback) => {
        callback(state);
      });
    });

    player.addListener('authentication_error', ({ message }) => {
      console.error('Spotify player authentication error:', message);
      isPlayerReady = false;
      readyCallbacks.forEach((callback) => callback(false));
      authenticationErrorCallbacks.forEach((callback) => callback(message));
      if (message.includes('Invalid token scopes') || message.includes('scope')) {
        console.warn('Token scopes are invalid. Clearing tokens and requiring re-authentication.');
        handleSpotifyLogout();
      }
    });

    player.addListener('account_error', ({ message }) => {
      console.error('Spotify player account error:', message);
      isPlayerReady = false;
      readyCallbacks.forEach((callback) => callback(false));
    });

    const connected = await player.connect();
    if (!connected) {
      console.error('Failed to connect to Spotify player');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error initializing Spotify player:', error);
    return false;
  }
}

export async function getPlayer(): Promise<Spotify.Player | null> {
  if (!player) {
    const initialized = await initializePlayer();
    if (!initialized) {
      return null;
    }
  }
  return player;
}

export function getDeviceId(): string | null {
  return deviceId;
}

export function isReady(): boolean {
  return isPlayerReady && deviceId !== null;
}

export function getCurrentState(): Spotify.PlaybackState | null {
  return playerState;
}

export function subscribeToStateChanges(
  callback: (state: Spotify.PlaybackState | null) => void
): () => void {
  stateChangeCallbacks.push(callback);
  return () => {
    stateChangeCallbacks = stateChangeCallbacks.filter((cb) => cb !== callback);
  };
}

export function subscribeToReadyState(callback: (ready: boolean) => void): () => void {
  readyCallbacks.push(callback);
  callback(isPlayerReady);
  return () => {
    readyCallbacks = readyCallbacks.filter((cb) => cb !== callback);
  };
}

export function subscribeToAuthenticationErrors(callback: (message: string) => void): () => void {
  authenticationErrorCallbacks.push(callback);
  return () => {
    authenticationErrorCallbacks = authenticationErrorCallbacks.filter((cb) => cb !== callback);
  };
}

export async function disconnectPlayer(): Promise<void> {
  if (player) {
    try {
      player.disconnect();
    } catch (error) {
      console.error('Error disconnecting player:', error);
    }
    player = null;
    deviceId = null;
    isPlayerReady = false;
    playerState = null;
    stateChangeCallbacks = [];
    readyCallbacks = [];
    authenticationErrorCallbacks = [];
  }
}
