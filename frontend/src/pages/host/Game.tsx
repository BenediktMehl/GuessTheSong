import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../components/Card';
import PlayersLobby from '../../components/PlayersLobby';
import { useGameContext } from '../../game/context';

const HIDE_SONG_UNTIL_BUZZED_KEY = 'hostHideSongUntilBuzzed';

// Track object structure as per tutorial
const track = {
  name: '',
  album: {
    images: [{ url: '' }],
  },
  artists: [{ name: '' }],
};

// Spotify Player types
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
  addListener(event: 'player_state_changed', callback: (state: SpotifyPlaybackState | null) => void): boolean;
  addListener(event: 'initialization_error', callback: (error: { message: string }) => void): boolean;
  addListener(event: 'authentication_error', callback: (error: { message: string }) => void): boolean;
  addListener(event: 'account_error', callback: (error: { message: string }) => void): boolean;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  togglePlay(): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
}

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

export default function Game() {
  const { players, waitingPlayers } = useGameContext();
  const [player, setPlayer] = useState<SpotifyPlayer | undefined>(undefined);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [is_paused, setPaused] = useState(false);
  const [is_active, setActive] = useState(false);
  const [current_track, setTrack] = useState(track);
  const [isTransferring, setIsTransferring] = useState(false);
  const hasAttemptedTransferRef = useRef(false);
  const playerInitializedRef = useRef(false);
  const [hideSongUntilBuzzed, setHideSongUntilBuzzed] = useState<boolean>(() => {
    const stored = localStorage.getItem(HIDE_SONG_UNTIL_BUZZED_KEY);
    return stored === 'true';
  });

  // Transfer playback to this device using Spotify Web API
  const transferPlaybackToDevice = useCallback(async (targetDeviceId: string, spotifyPlayerInstance?: SpotifyPlayer) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('[Spotify] No access token available for transfer');
      return;
    }

    setIsTransferring(true);
    try {
      console.log('[Spotify] Transferring playback to device:', targetDeviceId);
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [targetDeviceId],
          play: false, // Don't auto-play - browser blocks autoplay anyway
        }),
      });

      if (response.status === 204) {
        console.log('[Spotify] Playback transferred successfully');
        // Wait a bit for the state to update
        setTimeout(() => {
          const playerToCheck = spotifyPlayerInstance || player;
          playerToCheck?.getCurrentState().then((state) => {
            if (state) {
              setActive(true);
              setPaused(state.paused);
              setTrack(state.track_window.current_track);
            }
          }).catch((error) => {
            console.error('[Spotify] Error getting state after transfer:', error);
          });
        }, 1000);
      } else if (response.status === 404) {
        console.warn('[Spotify] No active device found to transfer from');
        // This is okay - user needs to start playback on another device first
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Spotify] Failed to transfer playback:', response.status, errorData);
      }
    } catch (error) {
      console.error('[Spotify] Error transferring playback:', error);
    } finally {
      setIsTransferring(false);
    }
  }, [player]);

  // Initialize player following the tutorial exactly
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.log('No access token available');
      return;
    }

    // Prevent multiple initializations
    if (playerInitializedRef.current) {
      console.log('[Spotify] Player already initialized');
      return;
    }
    playerInitializedRef.current = true;

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
    if (existingScript) {
      console.log('[Spotify] SDK script already loaded');
      // If SDK is already loaded, initialize player directly
      if (window.Spotify) {
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
        spotifyPlayer.connect();
      }
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

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('[Spotify] Ready with Device ID', device_id);
        setDeviceId(device_id);
        
        // Check initial state when ready
        spotifyPlayer.getCurrentState().then((state) => {
          if (state) {
            console.log('[Spotify] Initial state:', {
              paused: state.paused,
              track: state.track_window.current_track.name,
            });
            setActive(true);
            setPaused(state.paused);
            setTrack(state.track_window.current_track);
            hasAttemptedTransferRef.current = true; // Mark as attempted since we have state
          } else {
            console.log('[Spotify] No initial playback state');
            setActive(false);
            // Only attempt transfer once
            if (!hasAttemptedTransferRef.current) {
              console.log('[Spotify] Attempting to transfer playback');
              hasAttemptedTransferRef.current = true;
              // Use setTimeout to avoid calling during listener setup
              // Pass spotifyPlayer instance directly to avoid dependency issues
              setTimeout(() => {
                transferPlaybackToDevice(device_id, spotifyPlayer);
              }, 1500);
            } else {
              console.log('[Spotify] Transfer already attempted, skipping');
            }
          }
        }).catch((error) => {
          console.error('[Spotify] Error getting initial state:', error);
        });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('[Spotify] Device ID has gone offline', device_id);
        setActive(false);
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) {
          console.log('[Spotify] Player state changed: null state - playback may have been transferred away');
          setActive(false);
          // Clear track info when state is null
          setTrack(track);
          return;
        }

        console.log('[Spotify] Player state changed:', {
          paused: state.paused,
          track: state.track_window.current_track.name,
        });

        setTrack(state.track_window.current_track);
        setPaused(state.paused);
        setActive(true); // If we have state, we're active
        // Don't call getCurrentState() here - it can cause loops and we already have the state
      });

      spotifyPlayer.connect();
    };

    return () => {
      // Cleanup: disconnect player but don't remove script (it might be used by other components)
      if (player) {
        player.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleToggleHideSong = (checked: boolean) => {
    setHideSongUntilBuzzed(checked);
    localStorage.setItem(HIDE_SONG_UNTIL_BUZZED_KEY, checked.toString());
  };

  // Determine if song should be visible
  const shouldShowSong = !hideSongUntilBuzzed || waitingPlayers.length > 0;

  // Determine body class based on track and visibility
  const nowPlayingBodyClass =
    current_track.name && shouldShowSong ? 'flex items-center gap-4' : 'items-center text-center gap-2';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <h2 className="text-4xl font-bold text-primary mb-2">Host Game</h2>

      <div className="w-full max-w-md flex flex-col gap-6">
        <Card title="Now Playing" className="w-full" bodyClassName={nowPlayingBodyClass}>
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
                  <div className="text-xs text-base-content/60">{(current_track.album as any).name || ''}</div>
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

        <Card title="Settings" className="w-full" bodyClassName="flex flex-col gap-2">
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

        <Card title="Spotify Player" className="w-full" bodyClassName="flex flex-col gap-3">
          {!is_active ? (
            <div className="flex flex-col gap-3">
              <div className="alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <div>
                  <h3 className="font-bold">Ready to play!</h3>
                  <div className="text-sm">
                    {isTransferring
                      ? 'Transferring playback...'
                      : 'Playback will be transferred automatically, or you can transfer manually from another Spotify device.'}
                  </div>
                </div>
              </div>
              {!isTransferring && deviceId && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => transferPlaybackToDevice(deviceId, player)}
                >
                  Transfer Playback Now
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline flex-1"
                onClick={() => {
                  player?.previousTrack();
                }}
                disabled={!player}
              >
                &lt;&lt;
              </button>
              <button
                type="button"
                className="btn btn-warning flex-1"
                onClick={async () => {
                  if (!player) {
                    console.error('[Spotify] Player not available');
                    return;
                  }
                  try {
                    console.log('[Spotify] Toggling play, current paused state:', is_paused);
                    console.log('[Spotify] Current track:', current_track.name || 'No track');
                    console.log('[Spotify] Player active:', is_active);
                    
                    // Check current state before toggling
                    const currentState = await player.getCurrentState();
                    console.log('[Spotify] Current state before toggle:', {
                      hasState: !!currentState,
                      paused: currentState?.paused,
                      track: currentState?.track_window.current_track.name,
                    });
                    
                    if (!currentState) {
                      console.warn('[Spotify] No active playback state. Make sure playback is transferred to this device and a track is loaded.');
                      alert('No active playback. Please transfer playback to "Guess The Song" from another Spotify client and ensure a track is loaded.');
                      return;
                    }
                    
                    await player.togglePlay();
                    console.log('[Spotify] togglePlay() called successfully');
                    
                    // Check state after a short delay
                    setTimeout(async () => {
                      const newState = await player.getCurrentState();
                      console.log('[Spotify] State after toggle:', {
                        hasState: !!newState,
                        paused: newState?.paused,
                        track: newState?.track_window.current_track.name,
                      });
                      
                      if (newState) {
                        // Update local state to match
                        setPaused(newState.paused);
                        setTrack(newState.track_window.current_track);
                      }
                    }, 500);
                  } catch (error) {
                    console.error('[Spotify] Error toggling play:', error);
                    alert(`Error controlling playback: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
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
                disabled={!player}
              >
                &gt;&gt;
              </button>
            </div>
          )}
        </Card>

        <PlayersLobby players={players} />
      </div>
    </main>
  );
}
