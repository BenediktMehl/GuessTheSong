import { DEFAULT_PLAYLIST_ID } from './playlists';
import logger from '../../utils/logger';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  owner: {
    display_name: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
}

interface SpotifyPlaylistResponse {
  items: Array<{
    id: string;
    name: string;
    description: string;
    images: Array<{ url: string }>;
    owner: {
      display_name: string;
    };
  }>;
  next: string | null;
}

interface SpotifyPlaylistTracksResponse {
  items: Array<{
    track: {
      id: string;
      name: string;
      uri: string;
      artists: Array<{ name: string }>;
      album: {
        name: string;
        images: Array<{ url: string }>;
      };
      duration_ms: number;
    } | null;
  }>;
  next: string | null;
}

/**
 * Get the access token from localStorage
 */
function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

/**
 * Make an authenticated request to Spotify API
 */
async function spotifyRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }

  const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Spotify API error: ${response.status} - ${error.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch all user playlists (handles pagination)
 */
export async function getUserPlaylists(): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url = '/me/playlists?limit=50';

  while (url) {
    const response = await spotifyRequest<SpotifyPlaylistResponse>(url);
    playlists.push(...response.items);
    url = response.next ? response.next.replace(SPOTIFY_API_BASE, '') : '';
  }

  return playlists;
}

// Keep getPlaylistTracks for any remaining code that might use it, but it's no longer needed for main flow
// Can be removed later if not used elsewhere
export async function getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url = `/playlists/${playlistId}/tracks?limit=50&fields=items(track(id,name,uri,artists,album,duration_ms)),next`;

  while (url) {
    const response = await spotifyRequest<SpotifyPlaylistTracksResponse>(url);
    // Filter out null tracks (some playlists may have unavailable tracks)
    const validTracks = response.items
      .map((item) => item.track)
      .filter((track): track is NonNullable<typeof track> => track !== null);
    tracks.push(...validTracks);
    url = response.next ? response.next.replace(SPOTIFY_API_BASE, '') : '';
  }

  return tracks;
}

/**
 * Enable shuffle mode for Spotify playback
 */
export async function enableShuffle(deviceId: string, shuffle: boolean = true): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }

  const response = await fetch(
    `${SPOTIFY_API_BASE}/me/player/shuffle?state=${shuffle}&device_id=${deviceId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  // 404 means no active device, which is fine - will be handled when playing
  if (!response.ok && response.status !== 404) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to enable shuffle: ${response.status} - ${error.message || response.statusText}`
    );
  }
}

/**
 * Start playing a playlist with shuffle enabled (Spotify handles random selection)
 */
export async function playPlaylist(deviceId: string, playlistId: string): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }

  // First enable shuffle
  try {
    await enableShuffle(deviceId, true);
    logger.debug('[Spotify] Shuffle enabled');
  } catch (error) {
    logger.warn('[Spotify] Failed to enable shuffle, continuing anyway:', error);
    // Non-critical, continue
  }

  // Start playing the playlist (Spotify will pick a random track with shuffle enabled)
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context_uri: `spotify:playlist:${playlistId}`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to play playlist: ${response.status} - ${error.message || response.statusText}`
    );
  }
}

/**
 * Play next track in playlist (Spotify handles random selection with shuffle)
 */
export async function playNextTrack(deviceId: string): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }

  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/next?device_id=${deviceId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to play next track: ${response.status} - ${error.message || response.statusText}`
    );
  }
}

/**
 * Get the selected playlist ID from localStorage, or return default
 */
export function getSelectedPlaylistId(): string {
  const stored = localStorage.getItem('spotify_selected_playlist_id');
  return stored || DEFAULT_PLAYLIST_ID;
}

/**
 * Save the selected playlist ID to localStorage
 */
export function setSelectedPlaylistId(playlistId: string): void {
  localStorage.setItem('spotify_selected_playlist_id', playlistId);
}

/**
 * Check if playlist has at least one track (for validation)
 */
export async function validatePlaylistHasTracks(playlistId: string): Promise<boolean> {
  try {
    // Just fetch first page of tracks to check if playlist is not empty
    const response = await spotifyRequest<SpotifyPlaylistTracksResponse>(
      `/playlists/${playlistId}/tracks?limit=1&fields=items(track(id))`
    );
    const hasTracks = response.items.some((item) => item.track !== null);
    return hasTracks;
  } catch (error) {
    logger.error('[Spotify] Error validating playlist:', error);
    return false;
  }
}

/**
 * Stop current Spotify playback
 */
export async function stopPlayback(deviceId?: string): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }

  const deviceParam = deviceId ? `?device_id=${deviceId}` : '';
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/pause${deviceParam}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // 404 means no active playback, which is fine
  if (!response.ok && response.status !== 404) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to stop playback: ${response.status} - ${error.message || response.statusText}`
    );
  }
}
