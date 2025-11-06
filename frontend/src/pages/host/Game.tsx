import { useEffect, useRef, useState } from 'react';
import { Card } from '../../components/Card';
import PlayersLobby from '../../components/PlayersLobby';
import { useGameContext } from '../../game/context';

const HIDE_SONG_UNTIL_BUZZED_KEY = 'hostHideSongUntilBuzzed';

// Spotify Player types
interface SpotifyPlaybackState {
  paused: boolean;
  track_window: {
    current_track: {
      id: string;
      name: string;
      uri: string;
      artists: Array<{ name: string }>;
      album: {
        name: string;
        images: Array<{ url: string }>;
      };
      duration_ms: number;
    };
  };
}

declare global {
  interface Window {
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (callback: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady: (() => void) | null;
  }
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready', callback: (data: { device_id: string }) => void): boolean;
  addListener(event: 'not_ready', callback: (data: { device_id: string }) => void): boolean;
  addListener(
    event: 'player_state_changed',
    callback: (state: SpotifyPlaybackState | null) => void
  ): boolean;
  addListener(
    event: 'initialization_error',
    callback: (error: { message: string }) => void
  ): boolean;
  addListener(
    event: 'authentication_error',
    callback: (error: { message: string }) => void
  ): boolean;
  addListener(event: 'account_error', callback: (error: { message: string }) => void): boolean;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  togglePlay(): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
}

// Track object structure as per tutorial
const track: SpotifyPlaybackState['track_window']['current_track'] = {
  id: '',
  name: '',
  uri: '',
  artists: [{ name: '' }],
  album: {
    name: '',
    images: [{ url: '' }],
  },
  duration_ms: 0,
};

export default function Game() {
  const { players, waitingPlayers } = useGameContext();
  const [player, setPlayer] = useState<SpotifyPlayer | undefined>(undefined);
  const playerRef = useRef<SpotifyPlayer | undefined>(undefined);
  const [is_paused, setPaused] = useState(false);
  const [is_active, setActive] = useState(false);
  const [current_track, setTrack] = useState(track);
  const [hideSongUntilBuzzed, setHideSongUntilBuzzed] = useState<boolean>(() => {
    const stored = localStorage.getItem(HIDE_SONG_UNTIL_BUZZED_KEY);
    return stored === 'true';
  });

  // Initialize player following the tutorial exactly
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.log('No access token available');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Guess The Song',
        getOAuthToken: (cb) => {
          const token = localStorage.getItem('access_token');
          if (token) {
            cb(token);
          }
        },
        volume: 0.5,
      });

      setPlayer(spotifyPlayer);
      playerRef.current = spotifyPlayer;

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) {
          return;
        }

        setTrack(state.track_window.current_track);
        setPaused(state.paused);

        spotifyPlayer.getCurrentState().then((playerState) => {
          if (!playerState) {
            setActive(false);
          } else {
            setActive(true);
          }
        });
      });

      spotifyPlayer.connect();
    };

    return () => {
      // Cleanup: remove script if component unmounts
      const existingScript = document.querySelector(
        'script[src="https://sdk.scdn.co/spotify-player.js"]'
      );
      if (existingScript) {
        existingScript.remove();
      }
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, []);

  const handleToggleHideSong = (checked: boolean) => {
    setHideSongUntilBuzzed(checked);
    localStorage.setItem(HIDE_SONG_UNTIL_BUZZED_KEY, checked.toString());
  };

  // Determine if song should be visible
  const shouldShowSong = !hideSongUntilBuzzed || waitingPlayers.length > 0;

  // Determine body class based on track and visibility
  const nowPlayingBodyClass =
    current_track.name && shouldShowSong
      ? 'flex items-center gap-4'
      : 'items-center text-center gap-2';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        <Card className="w-full" bodyClassName={nowPlayingBodyClass}>
          {current_track.name ? (
            shouldShowSong ? (
              <>
                <img
                  src={current_track.album.images[0]?.url}
                  alt={current_track.name}
                  className="w-16 h-16 rounded-xl shadow-lg"
                />
                <div className="text-left">
                  <div className="font-bold text-lg">{current_track.name}</div>
                  <div className="text-sm text-base-content/70">
                    {current_track.artists[0]?.name || ''}
                  </div>
                  <div className="text-xs text-base-content/60">
                    {current_track.album.name || ''}
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full text-sm text-base-content/60 text-center">
                Song hidden - waiting for player guess...
              </div>
            )
          ) : (
            <div className="w-full text-sm text-base-content/60">No track playing</div>
          )}
        </Card>

        <Card className="w-full" bodyClassName="flex flex-col gap-2">
          <label className="label cursor-pointer">
            <span className="label-text">Hide song until player guesses</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={hideSongUntilBuzzed}
              onChange={(e) => handleToggleHideSong(e.target.checked)}
            />
          </label>
        </Card>

        <Card className="w-full" bodyClassName="flex flex-col gap-2">
          {!is_active && (
            <div className="alert alert-info mb-2">
              <span>
                Transfer playback to this device from another Spotify client to start playing.
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline flex-1"
              onClick={() => {
                player?.previousTrack();
              }}
              disabled={!player || !is_active}
            >
              &lt;&lt;
            </button>
            <button
              type="button"
              className="btn btn-warning flex-1"
              onClick={() => {
                player?.togglePlay();
              }}
              disabled={!player || !is_active}
            >
              {is_paused ? 'PLAY' : 'PAUSE'}
            </button>
            <button
              type="button"
              className="btn btn-outline flex-1"
              onClick={() => {
                player?.nextTrack();
              }}
              disabled={!player || !is_active}
            >
              &gt;&gt;
            </button>
          </div>
        </Card>

        <PlayersLobby players={players} />
      </div>
    </main>
  );
}
