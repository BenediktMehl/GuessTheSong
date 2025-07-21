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
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return SpotifyResponseStatus.ERROR;
    }

    const url = 'https://api.spotify.com/v1/me/player/next';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        if (error.error.reason === "NO_ACTIVE_DEVICE") {
            console.error("No active device found for playback");
            return SpotifyResponseStatus.NO_ACTIVE_DEVICE;
        }
        return SpotifyResponseStatus.ERROR;
    }

    return SpotifyResponseStatus.PLAYING;
}

export async function pauseOrResumeSpotifyTrack() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return SpotifyResponseStatus.ERROR;
    }
    const playbackState = await getPlaybackState();
    if (!playbackState) {
        console.error("Failed to get playback state");
        return SpotifyResponseStatus.ERROR;
    }   
    const isPlaying = playbackState.is_playing;
    const url = 'https://api.spotify.com/v1/me/player/' + (isPlaying ? 'pause' : 'play');
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        const error = await response.json();
        if (error.error.reason === "NO_ACTIVE_DEVICE") {
            console.error("No active device found for playback");
            return SpotifyResponseStatus.NO_ACTIVE_DEVICE;
        }
        return SpotifyResponseStatus.ERROR;
    }
    return isPlaying ? SpotifyResponseStatus.PAUSED : SpotifyResponseStatus.PLAYING;
}

export async function playSpotifyTrack(trackUri: string) {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return SpotifyResponseStatus.ERROR;
    }

    const url = 'https://api.spotify.com/v1/me/player/play';
    const body = {
        uris: [trackUri],
    };

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        if(error.error.reason === "NO_ACTIVE_DEVICE") {
            console.error("No active device found for playback");
            return SpotifyResponseStatus.NO_ACTIVE_DEVICE;
        }
        return SpotifyResponseStatus.ERROR;
    }

    return SpotifyResponseStatus.PLAYING;
}

export async function getPlaybackState() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.error("No access token found in localStorage");
        return null;
    }

    const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        console.error("Failed to fetch playback state:", response.statusText);
        return null;
    }

    return await response.json();
}