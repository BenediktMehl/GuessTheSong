import { DEFAULT_PLAYLIST_ID } from './playlists';

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

/**
 * Fetch all tracks from a playlist (handles pagination)
 */
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
 * Play a specific track from a playlist using Spotify Web API
 */
export async function playPlaylistTrack(
  deviceId: string,
  playlistId: string,
  trackUri: string
): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }

  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context_uri: `spotify:playlist:${playlistId}`,
      offset: {
        uri: trackUri,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(
      `Failed to play track: ${response.status} - ${error.message || response.statusText}`
    );
  }
}

/**
 * Play a random track from a playlist
 */
export async function playRandomPlaylistTrack(
  deviceId: string,
  playlistId: string,
  tracks: SpotifyTrack[],
  excludeTrackIds: string[] = []
): Promise<SpotifyTrack> {
  if (tracks.length === 0) {
    throw new Error('Playlist has no tracks');
  }

  // Filter out excluded tracks (already played)
  const availableTracks = tracks.filter((track) => !excludeTrackIds.includes(track.id));

  if (availableTracks.length === 0) {
    // All tracks have been played, reset and use all tracks
    console.log('[Spotify] All tracks played, resetting track history');
    return playRandomPlaylistTrack(deviceId, playlistId, tracks, []);
  }

  // Select random track
  const randomIndex = Math.floor(Math.random() * availableTracks.length);
  const selectedTrack = availableTracks[randomIndex];

  await playPlaylistTrack(deviceId, playlistId, selectedTrack.uri);
  return selectedTrack;
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
