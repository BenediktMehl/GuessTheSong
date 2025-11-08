import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import PlayersLobby from '../../components/PlayersLobby';
import { setGlobalPausePlayer, useGameContext } from '../../game/context';
import {
  markPlayerGuessedRight,
  markPlayerGuessedWrong,
  resetAllPlayersForNewRound,
} from '../../game/host';

const HIDE_SONG_UNTIL_BUZZED_KEY = 'hostHideSongUntilBuzzed';
const SPOTIFY_VOLUME_KEY = 'spotifyVolume';

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
  setVolume(volume: number): Promise<void>;
}

interface SpotifyPlaybackState {
  paused: boolean;
  position: number; // Current playback position in milliseconds
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
  const gameContext = useGameContext();
  const {
    players,
    waitingPlayers,
    guessedPlayers,
    buzzerNotification,
    setBuzzerNotification,
    setPausePlayerCallback,
  } = gameContext;
  const navigate = useNavigate();

  // Calculate notGuessedPlayers (players not in waiting or guessed arrays)
  const waitingPlayerIds = new Set((waitingPlayers || []).map((p) => p.id));
  const guessedPlayerIds = new Set((guessedPlayers || []).map((p) => p.id));
  const notGuessedPlayers = (players || [])
    .filter((p) => !waitingPlayerIds.has(p.id) && !guessedPlayerIds.has(p.id))
    .sort((a, b) => b.points - a.points);
  const [player, setPlayer] = useState<SpotifyPlayer | undefined>(undefined);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [is_paused, setPaused] = useState(false);
  const [is_active, setActive] = useState(false);
  const [current_track, setTrack] = useState(track);
  const [isTransferring, setIsTransferring] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const hasAttemptedTransferRef = useRef(false);
  const playerInitializedRef = useRef(false);
  const playerInstanceRef = useRef<SpotifyPlayer | undefined>(undefined);
  const previousTrackIdRef = useRef<string>(''); // Track previous track ID to detect loops
  const hasLoopedRef = useRef(false); // Track if the song has looped once
  const previousPositionRef = useRef<number>(0); // Track previous position to detect loops
  const [hideSongUntilBuzzed, setHideSongUntilBuzzed] = useState<boolean>(() => {
    const stored = localStorage.getItem(HIDE_SONG_UNTIL_BUZZED_KEY);
    return stored === 'true';
  });
  const [volume, setVolume] = useState<number>(() => {
    const stored = localStorage.getItem(SPOTIFY_VOLUME_KEY);
    return stored ? parseFloat(stored) : 0.5;
  });
  const [currentPosition, setCurrentPosition] = useState<number>(0); // Current playback position in milliseconds
  const [trackDuration, setTrackDuration] = useState<number>(0); // Track duration in milliseconds
  const [isSeeking, setIsSeeking] = useState<boolean>(false); // Track if user is actively seeking
  const positionUpdateIntervalRef = useRef<number | null>(null);

  // Enable repeat mode for track (loop single track)
  const enableRepeatMode = useCallback(async (_trackId?: string) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('[Spotify] No access token available for repeat mode');
      return;
    }

    try {
      // Set repeat mode to 'track' (loop current track)
      const response = await fetch('https://api.spotify.com/v1/me/player/repeat?state=track', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 204) {
        console.log('[Spotify] Repeat mode enabled (track loop)');
      } else {
        console.warn('[Spotify] Failed to enable repeat mode:', response.status);
      }
    } catch (error) {
      console.error('[Spotify] Error enabling repeat mode:', error);
    }
  }, []);

  // Transfer playback to this device using Spotify Web API
  const transferPlaybackToDevice = useCallback(
    async (targetDeviceId: string, spotifyPlayerInstance?: SpotifyPlayer) => {
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
            Authorization: `Bearer ${accessToken}`,
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
            playerToCheck
              ?.getCurrentState()
              .then((state) => {
                if (state) {
                  setActive(true);
                  setPaused(state.paused);
                  const trackState = state.track_window.current_track;
                  setTrack(trackState);
                  const initialPosition = state.position || 0;
                  setCurrentPosition(initialPosition);
                  setTrackDuration(trackState.duration_ms || 0);
                  previousTrackIdRef.current = trackState.id;
                  previousPositionRef.current = initialPosition;
                  hasLoopedRef.current = false;
                  // Enable repeat mode for the track
                  enableRepeatMode(trackState.id);
                }
              })
              .catch((error) => {
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
    },
    [player, enableRepeatMode]
  );

  // Initialize player following the tutorial exactly
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.log('No access token available');
      setSpotifyError(
        'Etwas ist mit der Spotify-Verbindung schiefgelaufen. Bitte verbinde dich erneut. Gehe zurück zur Lobby und starte neu.'
      );
      return;
    }

    // Prevent multiple initializations
    if (playerInitializedRef.current) {
      console.log('[Spotify] Player already initialized');
      return;
    }
    playerInitializedRef.current = true;

    // Check if script is already loaded
    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    if (existingScript && window.Spotify) {
      console.log('[Spotify] SDK script already loaded');
      // If SDK is already loaded, initialize player directly
      const storedVolume = localStorage.getItem(SPOTIFY_VOLUME_KEY);
      const initialVolume = storedVolume ? parseFloat(storedVolume) : 0.5;
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Guess The Song',
        getOAuthToken: (cb) => {
          const token = localStorage.getItem('access_token');
          if (token) {
            cb(token);
          }
        },
        volume: initialVolume,
      });

      setPlayer(spotifyPlayer);
      // Store player instance for cleanup
      playerInstanceRef.current = spotifyPlayer;

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('[Spotify] Ready with Device ID', device_id);
        setDeviceId(device_id);
        setSpotifyError(null); // Clear error on successful connection

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            if (state) {
              console.log('[Spotify] Initial state:', {
                paused: state.paused,
                track: state.track_window.current_track.name,
                position: state.position,
              });
              setActive(true);
              setPaused(state.paused);
              setTrack(state.track_window.current_track);
              setCurrentPosition(state.position || 0);
              setTrackDuration(state.track_window.current_track.duration_ms || 0);
              hasAttemptedTransferRef.current = true;
            } else {
              console.log('[Spotify] No initial playback state');
              setActive(false);
              setCurrentPosition(0);
              setTrackDuration(0);
              if (!hasAttemptedTransferRef.current) {
                console.log('[Spotify] Attempting to transfer playback');
                hasAttemptedTransferRef.current = true;
                setTimeout(() => {
                  transferPlaybackToDevice(device_id, spotifyPlayer);
                }, 1500);
              }
            }
          })
          .catch((error) => {
            console.error('[Spotify] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('[Spotify] Device ID has gone offline', device_id);
        setActive(false);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('[Spotify] Authentication error:', message);
        setSpotifyError(
          'Etwas ist mit der Spotify-Verbindung schiefgelaufen. Bitte verbinde dich erneut. Gehe zurück zur Lobby und starte neu.'
        );
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        console.error('[Spotify] Initialization error:', message);
        setSpotifyError(
          'Etwas ist mit der Spotify-Verbindung schiefgelaufen. Bitte verbinde dich erneut. Gehe zurück zur Lobby und starte neu.'
        );
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('[Spotify] Account error:', message);
        setSpotifyError(
          'Etwas ist mit der Spotify-Verbindung schiefgelaufen. Bitte verbinde dich erneut. Gehe zurück zur Lobby und starte neu.'
        );
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) {
          console.log(
            '[Spotify] Player state changed: null state - playback may have been transferred away'
          );
          setActive(false);
          setTrack(track);
          setCurrentPosition(0);
          setTrackDuration(0);
          previousTrackIdRef.current = '';
          hasLoopedRef.current = false;
          return;
        }

        console.log('[Spotify] Player state changed:', {
          paused: state.paused,
          track: state.track_window.current_track.name,
          position: state.position,
        });

        const newTrackId = state.track_window.current_track.id;
        const position = state.position || 0;
        const duration = state.track_window.current_track.duration_ms || 0;
        const previousPosition = previousPositionRef.current;

        // Check if track changed (different track)
        const trackChanged =
          previousTrackIdRef.current && previousTrackIdRef.current !== newTrackId;

        if (trackChanged) {
          // New track started - enable repeat mode and reset loop tracking
          console.log('[Spotify] New track started, enabling repeat mode');
          previousTrackIdRef.current = newTrackId;
          hasLoopedRef.current = false;
          enableRepeatMode(newTrackId);
        } else if (previousTrackIdRef.current === '') {
          // First time we see this track - enable repeat mode
          previousTrackIdRef.current = newTrackId;
          hasLoopedRef.current = false;
          enableRepeatMode(newTrackId);
        } else {
          // Same track - check if it looped (position jumped from near end to near start)
          if (
            duration > 0 &&
            previousPosition > duration * 0.8 && // Was near the end (>80%)
            position < duration * 0.1 && // Now near the start (<10%)
            !hasLoopedRef.current // Haven't detected loop yet
          ) {
            // Song looped - pause it
            console.log('[Spotify] Song looped (second time started), pausing');
            hasLoopedRef.current = true;
            if (!state.paused) {
              const currentPlayer = playerInstanceRef.current;
              if (currentPlayer) {
                currentPlayer.togglePlay().catch((error) => {
                  console.error('[Host Game] Error pausing after loop:', error);
                });
              }
            }
            // Show full duration
            setCurrentPosition(Math.ceil(duration / 1000) * 1000);
            setPaused(true);
            return; // Don't update position normally
          }
        }

        // Update state normally
        setTrack(state.track_window.current_track);
        setCurrentPosition(position);
        setTrackDuration(duration);
        setPaused(state.paused);
        setActive(true);
      });

      spotifyPlayer.connect();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;

    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const storedVolume = localStorage.getItem(SPOTIFY_VOLUME_KEY);
      const initialVolume = storedVolume ? parseFloat(storedVolume) : 0.5;
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Guess The Song',
        getOAuthToken: (cb) => {
          const token = localStorage.getItem('access_token');
          if (token) {
            cb(token);
          }
        },
        volume: initialVolume,
      });

      setPlayer(spotifyPlayer);
      // Store player instance for cleanup
      playerInstanceRef.current = spotifyPlayer;

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('[Spotify] Ready with Device ID', device_id);
        setDeviceId(device_id);
        setSpotifyError(null); // Clear error on successful connection

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            if (state) {
              console.log('[Spotify] Initial state:', {
                paused: state.paused,
                track: state.track_window.current_track.name,
                position: state.position,
              });
              setActive(true);
              setPaused(state.paused);
              setTrack(state.track_window.current_track);
              setCurrentPosition(state.position || 0);
              setTrackDuration(state.track_window.current_track.duration_ms || 0);
              hasAttemptedTransferRef.current = true; // Mark as attempted since we have state
            } else {
              console.log('[Spotify] No initial playback state');
              setActive(false);
              setCurrentPosition(0);
              setTrackDuration(0);
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
          })
          .catch((error) => {
            console.error('[Spotify] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('[Spotify] Device ID has gone offline', device_id);
        setActive(false);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('[Spotify] Authentication error:', message);
        setSpotifyError(
          'Etwas ist mit der Spotify-Verbindung schiefgelaufen. Bitte verbinde dich erneut. Gehe zurück zur Lobby und starte neu.'
        );
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        console.error('[Spotify] Initialization error:', message);
        setSpotifyError(
          'Etwas ist mit der Spotify-Verbindung schiefgelaufen. Bitte verbinde dich erneut. Gehe zurück zur Lobby und starte neu.'
        );
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('[Spotify] Account error:', message);
        setSpotifyError(
          'Etwas ist mit der Spotify-Verbindung schiefgelaufen. Bitte verbinde dich erneut. Gehe zurück zur Lobby und starte neu.'
        );
      });

      // Use ref to track previous track ID to detect track changes
      const previousTrackIdRef = { current: '' };

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) {
          console.log(
            '[Spotify] Player state changed: null state - playback may have been transferred away'
          );
          setActive(false);
          // Clear track info when state is null
          setTrack(track);
          setCurrentPosition(0);
          setTrackDuration(0);
          previousTrackIdRef.current = '';
          hasLoopedRef.current = false;
          return;
        }

        console.log('[Spotify] Player state changed:', {
          paused: state.paused,
          track: state.track_window.current_track.name,
          position: state.position,
        });

        const newTrackId = state.track_window.current_track.id;
        const position = state.position || 0;
        const duration = state.track_window.current_track.duration_ms || 0;
        const previousPosition = previousPositionRef.current;

        // Check if track changed (different track)
        const trackChanged =
          previousTrackIdRef.current && previousTrackIdRef.current !== newTrackId;

        if (trackChanged) {
          // New track started - enable repeat mode and reset loop tracking
          console.log('[Spotify] New track started, enabling repeat mode');
          previousTrackIdRef.current = newTrackId;
          previousPositionRef.current = position;
          hasLoopedRef.current = false;
          enableRepeatMode(newTrackId);
        } else if (previousTrackIdRef.current === '') {
          // First time we see this track - enable repeat mode
          previousTrackIdRef.current = newTrackId;
          previousPositionRef.current = position;
          hasLoopedRef.current = false;
          enableRepeatMode(newTrackId);
        } else {
          // Same track - check if it looped (position jumped from near end to near start)
          if (
            duration > 0 &&
            previousPosition > duration * 0.8 && // Was near the end (>80%)
            position < duration * 0.1 && // Now near the start (<10%)
            !hasLoopedRef.current // Haven't detected loop yet
          ) {
            // Song looped - pause it
            console.log('[Spotify] Song looped (second time started), pausing');
            hasLoopedRef.current = true;
            if (!state.paused) {
              const currentPlayer = playerInstanceRef.current;
              if (currentPlayer) {
                currentPlayer.togglePlay().catch((error) => {
                  console.error('[Host Game] Error pausing after loop:', error);
                });
              }
            }
            // Show full duration
            const roundedDuration = Math.ceil(duration / 1000) * 1000;
            setCurrentPosition(roundedDuration);
            previousPositionRef.current = roundedDuration;
            setPaused(true);
            setTrack(state.track_window.current_track);
            setTrackDuration(duration);
            setActive(true);
            return; // Don't update position normally
          }
        }

        // Update state normally
        setTrack(state.track_window.current_track);
        setCurrentPosition(position);
        setTrackDuration(duration);
        setPaused(state.paused);
        setActive(true);
        // Update previous position ref
        previousPositionRef.current = position;
        // Don't call getCurrentState() here - it can cause loops and we already have the state
      });

      spotifyPlayer.connect();
    };

    return () => {
      // Cleanup: disconnect player but don't remove script (it might be used by other components)
      // Get player instance from ref (stored during initialization)
      if (playerInstanceRef.current) {
        playerInstanceRef.current.disconnect();
        playerInstanceRef.current = undefined;
      }
    };
  }, [transferPlaybackToDevice, enableRepeatMode]);

  const handleToggleHideSong = (checked: boolean) => {
    setHideSongUntilBuzzed(checked);
    localStorage.setItem(HIDE_SONG_UNTIL_BUZZED_KEY, checked.toString());
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem(SPOTIFY_VOLUME_KEY, newVolume.toString());
    if (player) {
      try {
        await player.setVolume(newVolume);
      } catch (error) {
        console.error('[Spotify] Error setting volume:', error);
      }
    }
  };

  // Determine if song should be visible
  const shouldShowSong = !hideSongUntilBuzzed || waitingPlayers.length > 0;

  // Format time from milliseconds to mm:ss
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Seek to a specific position in the song
  const handleSeek = async (positionMs: number) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !deviceId) {
      console.error('[Spotify] No access token or device ID available for seek');
      return;
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.status === 204) {
        console.log('[Spotify] Seeked to position:', positionMs);
        setCurrentPosition(positionMs);
      } else {
        console.error('[Spotify] Failed to seek:', response.status);
      }
    } catch (error) {
      console.error('[Spotify] Error seeking:', error);
    }
  };

  // Handle timeline slider change
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseInt(e.target.value, 10);
    setCurrentPosition(newPosition);
    setIsSeeking(true);
  };

  // Handle timeline slider release (when user finishes dragging)
  const handleTimelineMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    const newPosition = parseInt((e.target as HTMLInputElement).value, 10);
    handleSeek(newPosition);
    setIsSeeking(false);
  };

  // Handle timeline touch end (for mobile)
  const handleTimelineTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    const newPosition = parseInt((e.target as HTMLInputElement).value, 10);
    handleSeek(newPosition);
    setIsSeeking(false);
  };

  // Update position periodically when playing (only if not seeking)
  useEffect(() => {
    if (!is_active || !player || is_paused || isSeeking) {
      // Clear interval if paused, inactive, or user is seeking
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
      return;
    }

    // Update position periodically (every 500ms)
    positionUpdateIntervalRef.current = window.setInterval(async () => {
      const currentPlayer = playerInstanceRef.current || player;
      if (currentPlayer && !isSeeking) {
        try {
          const state = await currentPlayer.getCurrentState();
          if (state && !state.paused) {
            const newPosition = state.position || 0;
            const currentDuration = state.track_window.current_track.duration_ms || trackDuration;
            const currentTrackId = state.track_window.current_track.id;
            const prevPos = previousPositionRef.current;

            // Check if song looped (position jumped from near end to near start)
            if (
              currentDuration > 0 &&
              previousTrackIdRef.current === currentTrackId &&
              prevPos > currentDuration * 0.8 && // Was near the end (>80%)
              newPosition < currentDuration * 0.1 && // Now near the start (<10%)
              !hasLoopedRef.current // Haven't detected loop yet
            ) {
              // Song looped - pause it
              console.log('[Host Game] Song looped (detected in interval), pausing');
              hasLoopedRef.current = true;
              await currentPlayer.togglePlay();
              setPaused(true);
              // Show full duration
              setCurrentPosition(Math.ceil(currentDuration / 1000) * 1000);
            } else {
              // Update position normally
              setCurrentPosition(newPosition);
              previousPositionRef.current = newPosition;
            }
          }
        } catch (error) {
          console.error('[Host Game] Error updating position:', error);
        }
      }
    }, 500); // Check every 500ms

    return () => {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
    };
  }, [is_active, player, is_paused, isSeeking, trackDuration]);

  // Determine layout class for track display section - always center
  const trackDisplayClass =
    current_track.name && shouldShowSong ? 'flex items-center justify-center gap-4' : '';

  // Get current guessing player (first in waiting list)
  const currentGuessingPlayer =
    waitingPlayers && waitingPlayers.length > 0 ? waitingPlayers[0] : null;

  // Handle right guess
  const handleRightGuess = useCallback(async () => {
    if (!currentGuessingPlayer) return;

    markPlayerGuessedRight(gameContext, async () => {
      // Play next song
      if (player) {
        try {
          await player.nextTrack();
          console.log('[Host] Playing next song after correct guess');
        } catch (error) {
          console.error('[Host] Error playing next song:', error);
        }
      }
    });
  }, [currentGuessingPlayer, player, gameContext]);

  // Handle wrong guess
  const handleWrongGuess = useCallback(async () => {
    if (!currentGuessingPlayer) return;

    markPlayerGuessedWrong(
      gameContext,
      async () => {
        // Resume current song
        if (player && is_paused) {
          try {
            await player.togglePlay();
            console.log('[Host] Resuming song for next player');
          } catch (error) {
            console.error('[Host] Error resuming song:', error);
          }
        }
      },
      async () => {
        // Play next song if no more players can guess
        if (player) {
          try {
            await player.nextTrack();
            console.log('[Host] Playing next song - no more players can guess');
          } catch (error) {
            console.error('[Host] Error playing next song:', error);
          }
        }
      }
    );
  }, [currentGuessingPlayer, player, is_paused, gameContext]);

  // Create pause function that can be called from anywhere
  const pausePlayerFunction = useCallback(async () => {
    const currentPlayer = playerInstanceRef.current || player;
    console.log('[Host Game] Pause function called', {
      hasPlayer: !!currentPlayer,
      playerFromRef: !!playerInstanceRef.current,
    });

    if (currentPlayer) {
      try {
        // Get current state to check if we need to pause
        const currentState = await currentPlayer.getCurrentState();
        console.log('[Host Game] Current playback state:', currentState);

        if (currentState && !currentState.paused) {
          console.log('[Host Game] Pausing playback');
          await currentPlayer.togglePlay();
          console.log('[Host Game] Playback paused successfully');
          // Update local state
          setPaused(true);
        } else {
          console.log('[Host Game] Playback is already paused or no state');
        }
      } catch (error) {
        console.error('[Host Game] Error pausing playback:', error);
      }
    } else {
      console.error('[Host Game] No player available in pause function');
    }
  }, [player]);

  // Register pause callback in context and global
  useEffect(() => {
    if (player && is_active) {
      console.log('[Host Game] Registering pause callback', { player, is_active });
      setPausePlayerCallback(pausePlayerFunction);
      setGlobalPausePlayer(pausePlayerFunction);
    } else {
      console.log('[Host Game] Clearing pause callback', { player, is_active });
      setPausePlayerCallback(null);
      setGlobalPausePlayer(null);
    }
    return () => {
      setPausePlayerCallback(null);
      setGlobalPausePlayer(null);
    };
  }, [player, is_active, pausePlayerFunction, setPausePlayerCallback]);

  // Auto-dismiss buzzer notification after 3 seconds
  useEffect(() => {
    if (buzzerNotification) {
      const timer = setTimeout(() => {
        setBuzzerNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [buzzerNotification, setBuzzerNotification]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      {buzzerNotification && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-info shadow-2xl">
            <span>
              <strong>{buzzerNotification.playerName}</strong> hat den Buzzer gedrückt!
            </span>
          </div>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-6">
        <Card className="w-full" bodyClassName="flex flex-col gap-4">
          <div className={trackDisplayClass}>
            {current_track.name ? (
              shouldShowSong ? (
                <>
                  <img
                    src={current_track.album.images[0]?.url}
                    alt={current_track.name}
                    className="w-16 h-16 rounded-xl shadow-lg"
                  />
                  <div className="text-center">
                    <div className="font-bold text-lg">{current_track.name}</div>
                    <div className="text-sm text-base-content/70">
                      {(current_track.artists || []).map((artist) => artist.name).join(', ')}
                    </div>
                    <div className="text-xs text-base-content/60">
                      {'name' in current_track.album && typeof current_track.album.name === 'string'
                        ? current_track.album.name
                        : ''}
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full text-sm text-base-content/60 text-center">
                  Song hidden - waiting for player guess...
                </div>
              )
            ) : (
              <div className="w-full text-sm text-base-content/60 text-center">
                No track playing
              </div>
            )}
          </div>
        </Card>

        <Card className="w-full" bodyClassName="flex flex-col gap-3">
          {spotifyError ? (
            <div className="flex flex-col gap-3">
              <div className="alert alert-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Error icon"
                >
                  <title>Error icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="font-bold">Spotify-Verbindungsfehler</h3>
                  <div className="text-sm">{spotifyError}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/settings')}
              >
                Zurück zur Lobby
              </button>
            </div>
          ) : !is_active ? (
            <div className="flex flex-col gap-3">
              <div className="alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                  role="img"
                  aria-label="Information icon"
                >
                  <title>Information icon</title>
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
            <div className="flex flex-col gap-3">
              {/* Timeline - always visible when track is playing */}
              {current_track.name && is_active && trackDuration > 0 && (
                <div className="flex flex-col gap-2">
                  <input
                    type="range"
                    min="0"
                    max={Math.ceil(trackDuration / 1000) * 1000}
                    value={Math.min(currentPosition, Math.ceil(trackDuration / 1000) * 1000)}
                    onChange={handleTimelineChange}
                    onMouseUp={handleTimelineMouseUp}
                    onTouchEnd={handleTimelineTouchEnd}
                    className="range range-primary w-full"
                    step="1000"
                  />
                  <div className="flex justify-between text-xs text-base-content/70">
                    <span className="font-mono">
                      {formatTime(
                        Math.min(currentPosition, Math.ceil(trackDuration / 1000) * 1000)
                      )}
                    </span>
                    <span className="font-mono">
                      {formatTime(Math.ceil(trackDuration / 1000) * 1000)}
                    </span>
                  </div>
                </div>
              )}

              {/* Setting */}
              <label className="label cursor-pointer">
                <span className="label-text">Hide song until player guesses</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={hideSongUntilBuzzed}
                  onChange={(e) => handleToggleHideSong(e.target.checked)}
                />
              </label>

              <div className="divider my-0"></div>

              <div className="flex gap-2">
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
                      console.log('[Spotify] Has looped:', hasLoopedRef.current);

                      // Check current state before toggling
                      const currentState = await player.getCurrentState();
                      console.log('[Spotify] Current state before toggle:', {
                        hasState: !!currentState,
                        paused: currentState?.paused,
                        track: currentState?.track_window.current_track.name,
                      });

                      if (!currentState) {
                        console.warn(
                          '[Spotify] No active playback state. Make sure playback is transferred to this device and a track is loaded.'
                        );
                        alert(
                          'No active playback. Please transfer playback to "Guess The Song" from another Spotify client and ensure a track is loaded.'
                        );
                        return;
                      }

                      // If song has looped and is paused, jump to start (0:00) and reset loop tracking
                      if (hasLoopedRef.current && is_paused) {
                        console.log(
                          '[Spotify] Song has looped, jumping to start (0:00) before playing'
                        );
                        const accessToken = localStorage.getItem('access_token');
                        if (accessToken) {
                          try {
                            // Use Spotify Web API to seek to position 0
                            await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=0`, {
                              method: 'PUT',
                              headers: {
                                Authorization: `Bearer ${accessToken}`,
                              },
                            });
                            setCurrentPosition(0);
                            hasLoopedRef.current = false;
                            console.log('[Spotify] Jumped to start successfully');
                          } catch (seekError) {
                            console.error('[Spotify] Error seeking to start:', seekError);
                          }
                        }
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
                          setCurrentPosition(newState.position || 0);
                          setTrackDuration(newState.track_window.current_track.duration_ms || 0);
                          // Reset loop tracking if we're playing from start
                          if (newState.position === 0 || newState.position < 1000) {
                            hasLoopedRef.current = false;
                          }
                        }
                      }, 500);
                    } catch (error) {
                      console.error('[Spotify] Error toggling play:', error);
                      alert(
                        `Error controlling playback: ${error instanceof Error ? error.message : 'Unknown error'}`
                      );
                    }
                  }}
                  disabled={!player || !is_active}
                >
                  {is_paused ? 'PLAY' : 'PAUSE'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={async () => {
                    // Reset all players to default list before going to next song
                    console.log('[Host Game] Next button clicked - resetting all players');
                    resetAllPlayersForNewRound(gameContext);

                    // Go to next track
                    if (player) {
                      try {
                        await player.nextTrack();
                        console.log('[Host Game] Next track started');
                      } catch (error) {
                        console.error('[Host Game] Error going to next track:', error);
                      }
                    }
                  }}
                  disabled={!player}
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 shrink-0"
                >
                  <title>Volume icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                  />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="range range-primary flex-1"
                />
                <span className="text-sm font-medium w-12 text-right shrink-0">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          )}
        </Card>

        {currentGuessingPlayer && (
          <Card className="w-full" bodyClassName="flex flex-col gap-4 py-4">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">{currentGuessingPlayer.name} rät gerade</h2>
              <p className="text-base-content/70">War die Antwort richtig oder falsch?</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                className="btn btn-success btn-lg flex-1"
                onClick={handleRightGuess}
              >
                ✓ Richtig
              </button>
              <button
                type="button"
                className="btn btn-error btn-lg flex-1"
                onClick={handleWrongGuess}
              >
                ✗ Falsch
              </button>
            </div>
          </Card>
        )}

        <PlayersLobby
          notGuessedPlayers={notGuessedPlayers}
          waitingPlayers={waitingPlayers}
          guessedPlayers={guessedPlayers}
        />
      </div>
    </main>
  );
}
