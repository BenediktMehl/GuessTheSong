import { getPlayer, isReady } from './spotifyPlayer';

export const SpotifyResponseStatus = {
    NOT_TRIED: 'not_tried',
    TRYING: 'trying',
    PLAYING: 'playing',
    PAUSED: 'paused',
    NO_ACTIVE_DEVICE: 'no_active_device',
    ERROR: 'error',
} as const;
export type SpotifyResponseStatus = typeof SpotifyResponseStatus[keyof typeof SpotifyResponseStatus];

export async function skipTrack() {
    const player = await getPlayer();
    if (!player) {
        console.error("Spotify player not available");
        return SpotifyResponseStatus.ERROR;
    }

    if (!isReady()) {
        console.error("Spotify player is not ready");
        return SpotifyResponseStatus.NO_ACTIVE_DEVICE;
    }

    try {
        await player.nextTrack();
        return SpotifyResponseStatus.PLAYING;
    } catch (error) {
        console.error("Error skipping track:", error);
        return SpotifyResponseStatus.ERROR;
    }
}

export async function pauseOrResumeSpotifyTrack() {
    const player = await getPlayer();
    if (!player) {
        console.error("Spotify player not available");
        return SpotifyResponseStatus.ERROR;
    }

    if (!isReady()) {
        console.error("Spotify player is not ready");
        return SpotifyResponseStatus.NO_ACTIVE_DEVICE;
    }

    try {
        const state = await player.getCurrentState();
        if (!state) {
            console.error("Unable to get current playback state");
            return SpotifyResponseStatus.ERROR;
        }

        const isPlaying = !state.paused;
        if (isPlaying) {
            await player.pause();
            return SpotifyResponseStatus.PAUSED;
        } else {
            await player.resume();
            return SpotifyResponseStatus.PLAYING;
        }
    } catch (error) {
        console.error("Error pausing/resuming track:", error);
        return SpotifyResponseStatus.ERROR;
    }
}

export async function playSpotifyTrack(trackUri: string) {
    const player = await getPlayer();
    if (!player) {
        console.error("Spotify player not available");
        return SpotifyResponseStatus.ERROR;
    }

    if (!isReady()) {
        console.error("Spotify player is not ready");
        return SpotifyResponseStatus.NO_ACTIVE_DEVICE;
    }

    // Defensive check: ensure player has play method
    if (!player.play || typeof player.play !== 'function') {
        console.error("Spotify player.play is not a function", {
            playerType: typeof player,
            playerConstructor: player?.constructor?.name,
            playerMethods: player ? Object.keys(player) : 'null',
        });
        return SpotifyResponseStatus.ERROR;
    }

    try {
        // Activate the player element before playing (required by Spotify SDK for autoplay policies)
        await player.activateElement();
        
        await player.play({
            uris: [trackUri],
        });
        return SpotifyResponseStatus.PLAYING;
    } catch (error) {
        console.error("Error playing track:", error, {
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            trackUri,
            playerReady: isReady(),
        });
        return SpotifyResponseStatus.ERROR;
    }
}

export async function getPlaybackState() {
    const player = await getPlayer();
    if (!player) {
        return null;
    }

    if (!isReady()) {
        return null;
    }

    try {
        const state = await player.getCurrentState();
        if (!state) {
            return null;
        }

        // Convert SDK state to REST API-like format for backward compatibility
        const track = state.track_window.current_track;
        return {
            is_playing: !state.paused,
            item: {
                id: track.id,
                name: track.name,
                uri: track.uri,
                artists: track.artists.map((artist) => ({ name: artist.name })),
                album: {
                    name: track.album.name,
                    images: track.album.images,
                },
                duration_ms: track.duration_ms,
            },
            progress_ms: state.position,
            duration_ms: state.duration,
        };
    } catch (error) {
        console.error("Error getting playback state:", error);
        return null;
    }
}

export interface SpotifyPlaylist {
    id: string;
    name: string;
    description?: string;
    images?: Array<{ url: string }>;
    owner?: {
        display_name?: string;
    };
    tracks?: {
        total: number;
    };
}

export interface SpotifyPlaylistsResponse {
    items: SpotifyPlaylist[];
    total: number;
    next: string | null;
}

export async function getUserPlaylists(limit = 50, offset = 0): Promise<SpotifyPlaylistsResponse | null> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return null;
    }

    const url = `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        console.error("Failed to fetch playlists:", response.statusText);
        return null;
    }

    return await response.json();
}

export interface SpotifyTrack {
    track: {
        id: string;
        uri: string;
        name: string;
        artists: Array<{ name: string }>;
        album: {
            name: string;
            images?: Array<{ url: string }>;
        };
        duration_ms: number;
    };
}

export interface SpotifyPlaylistTracksResponse {
    items: SpotifyTrack[];
    total: number;
    next: string | null;
}

export async function getPlaylistTracks(playlistId: string, limit = 100, offset = 0): Promise<SpotifyPlaylistTracksResponse | null> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return null;
    }

    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        console.error("Failed to fetch playlist tracks:", response.statusText);
        return null;
    }

    return await response.json();
}

export async function getPlaylistById(playlistId: string): Promise<SpotifyPlaylist | null> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return null;
    }

    const url = `https://api.spotify.com/v1/playlists/${playlistId}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        console.error("Failed to fetch playlist:", response.statusText);
        return null;
    }

    return await response.json();
}

export interface SpotifySearchResponse {
    playlists: {
        items: SpotifyPlaylist[];
        total: number;
        next: string | null;
    };
}

export async function searchPlaylists(query: string, limit = 20): Promise<SpotifySearchResponse | null> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return null;
    }

    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.spotify.com/v1/search?q=${encodedQuery}&type=playlist&limit=${limit}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        console.error("Failed to search playlists:", response.statusText);
        return null;
    }

    return await response.json();
}