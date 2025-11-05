// Type definitions for Spotify Web Playback SDK
declare namespace Spotify {
    interface Player {
        connect(): Promise<boolean>;
        disconnect(): void;
        addListener(event: 'ready', callback: (data: { device_id: string }) => void): boolean;
        addListener(event: 'not_ready', callback: (data: { device_id: string }) => void): boolean;
        addListener(event: 'player_state_changed', callback: (state: PlaybackState | null) => void): boolean;
        addListener(event: 'authentication_error', callback: (error: { message: string }) => void): boolean;
        addListener(event: 'account_error', callback: (error: { message: string }) => void): boolean;
        removeListener(event: string, callback?: Function): boolean;
        getCurrentState(): Promise<PlaybackState | null>;
        setName(name: string): Promise<void>;
        getVolume(): Promise<number>;
        setVolume(volume: number): Promise<void>;
        pause(): Promise<void>;
        resume(): Promise<void>;
        togglePlay(): Promise<void>;
        seek(position_ms: number): Promise<void>;
        previousTrack(): Promise<void>;
        nextTrack(): Promise<void>;
        activateElement(): Promise<void>;
        play(options?: PlayOptions): Promise<void>;
    }

    interface PlaybackState {
        context: {
            uri: string | null;
            metadata: any;
        };
        disallows: {
            pausing?: boolean;
            peeking_next?: boolean;
            peeking_prev?: boolean;
            resuming?: boolean;
            seeking?: boolean;
            skipping_next?: boolean;
            skipping_prev?: boolean;
        };
        duration: number;
        paused: boolean;
        position: number;
        repeat_mode: number;
        shuffle: boolean;
        track_window: {
            current_track: Track;
            previous_tracks: Track[];
            next_tracks: Track[];
        };
    }

    interface Track {
        album: {
            name: string;
            uri: string;
            images: Array<{ url: string; height?: number; width?: number }>;
        };
        artists: Array<{ name: string; uri: string }>;
        duration_ms: number;
        id: string;
        is_playable: boolean;
        name: string;
        uri: string;
    }

    interface PlayOptions {
        uris?: string[];
        context_uri?: string;
        offset?: {
            position?: number;
            uri?: string;
        };
        position_ms?: number;
    }

    interface PlayerConstructor {
        new (options: {
            name: string;
            getOAuthToken: (callback: (token: string) => void) => void;
            volume?: number;
        }): Player;
    }
}

declare var Spotify: {
    Player: Spotify.PlayerConstructor;
};

