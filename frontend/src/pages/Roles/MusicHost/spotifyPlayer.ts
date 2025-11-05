import { handleSpotifyLogout, spotifyIsLoggedIn } from './spotifyAuth';

let player: Spotify.Player | null = null;
let deviceId: string | null = null;
let isPlayerReady = false;
let playerState: Spotify.PlaybackState | null = null;
let stateChangeCallbacks: Array<(state: Spotify.PlaybackState | null) => void> = [];
let readyCallbacks: Array<(ready: boolean) => void> = [];
let authenticationErrorCallbacks: Array<(message: string) => void> = [];

// Reference to the global Spotify object
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
  // If SDK is already loaded, return immediately
  if (window.Spotify) {
    return true;
  }

  // Load the SDK script dynamically
  return new Promise((resolve) => {
    // Check if script is already being loaded
    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    if (existingScript) {
      // Script is loading, wait for it
      if (window.onSpotifyWebPlaybackSDKReady) {
        // Already has a callback, we need to chain ours
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

    // Set up the callback before loading the script
    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve(true);
    };

    // Create and load the script
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

    // Set up event listeners
    player.addListener('ready', ({ device_id }) => {
      console.log('Spotify player is ready with device ID:', device_id);
      deviceId = device_id;
      isPlayerReady = true;
      for (const callback of readyCallbacks) {
        callback(true);
      }
    });

    player.addListener('not_ready', ({ device_id }) => {
      console.log('Spotify player is not ready. Device ID:', device_id);
      isPlayerReady = false;
      for (const callback of readyCallbacks) {
        callback(false);
      }
    });

    player.addListener('player_state_changed', (state) => {
      playerState = state;
      // Notify all registered callbacks
      for (const callback of stateChangeCallbacks) {
        callback(state);
      }
    });

    player.addListener('authentication_error', ({ message }) => {
      console.error('Spotify player authentication error:', message);
      isPlayerReady = false;
      for (const callback of readyCallbacks) {
        callback(false);
      }

      // Check if error is related to invalid token scopes
      if (message.includes('Invalid token scopes') || message.includes('scope')) {
        console.warn('Token scopes are invalid. Clearing tokens and requiring re-authentication.');
        // Clear tokens and trigger re-authentication
        handleSpotifyLogout();
        // Notify all registered callbacks about the authentication error
        for (const callback of authenticationErrorCallbacks) {
          callback(message);
        }
      }
    });

    player.addListener('account_error', ({ message }) => {
      console.error('Spotify player account error:', message);
      isPlayerReady = false;
    });

    // Connect to the player
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
  // Player is only ready if:
  // 1. The ready event has fired (isPlayerReady is true)
  // 2. Device ID is available (player has connected successfully)
  return isPlayerReady && deviceId !== null;
}

export function getCurrentState(): Spotify.PlaybackState | null {
  return playerState;
}

export function subscribeToStateChanges(
  callback: (state: Spotify.PlaybackState | null) => void
): () => void {
  stateChangeCallbacks.push(callback);
  // Return unsubscribe function
  return () => {
    stateChangeCallbacks = stateChangeCallbacks.filter((cb) => cb !== callback);
  };
}

export function subscribeToReadyState(callback: (ready: boolean) => void): () => void {
  readyCallbacks.push(callback);
  // Immediately call with current state
  callback(isPlayerReady);
  // Return unsubscribe function
  return () => {
    readyCallbacks = readyCallbacks.filter((cb) => cb !== callback);
  };
}

export function subscribeToAuthenticationErrors(callback: (message: string) => void): () => void {
  authenticationErrorCallbacks.push(callback);
  // Return unsubscribe function
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
