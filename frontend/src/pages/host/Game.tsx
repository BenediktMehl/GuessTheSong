import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import PlayersLobby from '../../components/PlayersLobby';
import { setGlobalPausePlayer, useGameContext } from '../../game/context';
import {
  awardPartialPointsIfRoundEnded,
  markPlayerGuessedPartially,
  markPlayerGuessedRight,
  markPlayerGuessedWrong,
  resetAllPlayersForNewRound,
  sendLastSongChangedAction,
  sendNoPointsToastAction,
  useGameInitializer,
} from '../../game/host';
import { setBuzzerSoundMuted } from '../../game/player/buzzerSound';
import {
  getSelectedPlaylistId,
  pausePlayback,
  playNextTrack,
  playPlaylist,
} from '../../services/spotify/api';
import { logoutSpotify } from '../../services/spotify/auth';
import logger from '../../utils/logger';

const HIDE_SONG_UNTIL_BUZZED_KEY = 'hostHideSongUntilBuzzed';
const SPOTIFY_VOLUME_KEY = 'spotifyVolume';
const AUTOPLAY_KEY = 'hostAutoplay';
const BUZZER_SOUND_ENABLED_KEY = 'buzzerSoundEnabled';

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
    spotifyPlayerInstance: SpotifyPlayer | undefined;
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
    partiallyGuessedPlayers,
    noCluePlayers,
    buzzerNotification,
    setBuzzerNotification,
    setPausePlayerCallback,
    setLastSong,
    status,
  } = gameContext;
  const navigate = useNavigate();
  const { endGame } = useGameInitializer();

  // Calculate notGuessedPlayers (players not in waiting, guessed, partially guessed, or no clue arrays)
  const waitingPlayerIds = new Set((waitingPlayers || []).map((p) => p.id));
  const guessedPlayerIds = new Set((guessedPlayers || []).map((p) => p.id));
  const partiallyGuessedPlayerIds = new Set((partiallyGuessedPlayers || []).map((p) => p.id));
  const noCluePlayerIds = new Set((noCluePlayers || []).map((p) => p.id));
  const notGuessedPlayers = (players || [])
    .filter(
      (p) =>
        !waitingPlayerIds.has(p.id) &&
        !guessedPlayerIds.has(p.id) &&
        !partiallyGuessedPlayerIds.has(p.id) &&
        !noCluePlayerIds.has(p.id)
    )
    .sort((a, b) => b.points - a.points);
  const [player, setPlayer] = useState<SpotifyPlayer | undefined>(undefined);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [is_paused, setPaused] = useState(false);
  const [is_active, setActive] = useState(false);
  const [current_track, setTrack] = useState(track);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const hasAttemptedTransferRef = useRef(false);
  const playerInitializedRef = useRef(false);
  const playerInstanceRef = useRef<SpotifyPlayer | undefined>(undefined);
  const previousTrackIdRef = useRef<string>(''); // Track previous track ID to detect loops
  const hasLoopedRef = useRef(false); // Track if the song has looped once
  const previousPositionRef = useRef<number>(0); // Track previous position to detect loops
  const pendingPauseRef = useRef(false); // Track if we need to pause after track change
  const isChangingTrackRef = useRef<boolean>(false); // Track if we're intentionally changing tracks
  const [hideSongUntilBuzzed, setHideSongUntilBuzzed] = useState<boolean>(() => {
    const stored = localStorage.getItem(HIDE_SONG_UNTIL_BUZZED_KEY);
    // Default to true (enabled) if no value is stored
    return stored === null ? true : stored === 'true';
  });
  const [autoplay, setAutoplay] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTOPLAY_KEY);
    return stored === null ? true : stored === 'true'; // Default to true if not set
  });
  const [settingsExpanded, setSettingsExpanded] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(() => {
    const stored = localStorage.getItem(SPOTIFY_VOLUME_KEY);
    return stored ? parseFloat(stored) : 0.5;
  });
  const [buzzerSoundEnabled, setBuzzerSoundEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(BUZZER_SOUND_ENABLED_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [currentPosition, setCurrentPosition] = useState<number>(0); // Current playback position in milliseconds
  const [trackDuration, setTrackDuration] = useState<number>(0); // Track duration in milliseconds
  const [isSeeking, setIsSeeking] = useState<boolean>(false); // Track if user is actively seeking
  const positionUpdateIntervalRef = useRef<number | null>(null);

  // Playlist-related state
  const [playlistId, setPlaylistId] = useState<string>(getSelectedPlaylistId());
  const gameStartedRef = useRef(false);
  const firstTrackPlayedRef = useRef(false);
  const statePollingRef = useRef<number | null>(null);
  const statePollingTimeoutRef = useRef<number | null>(null);
  const listenerFiredRef = useRef(false);

  // Helper function to save current track as last song
  const saveLastSong = useCallback(
    (track: typeof current_track) => {
      if (track?.name && track.artists && track.artists.length > 0) {
        const lastSong = {
          name: track.name,
          artists: track.artists.map((artist) => artist.name),
        };
        logger.debug('[Host Game] Saving last song:', lastSong);
        setLastSong(lastSong);
        sendLastSongChangedAction(lastSong);
      }
    },
    [setLastSong]
  );

  // Enable repeat mode for track (loop single track)
  const enableRepeatMode = useCallback(async (_trackId?: string) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      logger.error('[Spotify] No access token available for repeat mode');
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
        logger.debug('[Spotify] Repeat mode enabled (track loop)');
      } else {
        logger.warn('[Spotify] Failed to enable repeat mode:', response.status);
      }
    } catch (error) {
      logger.error('[Spotify] Error enabling repeat mode:', error);
    }
  }, []);

  // Play playlist with shuffle enabled (Spotify handles random selection)
  const startPlaylistPlayback = useCallback(async () => {
    if (!deviceId || !playlistId) {
      logger.error('[Spotify] No device ID or playlist ID available');
      return;
    }

    try {
      logger.debug('[Spotify] Starting playlist playback with shuffle:', playlistId);
      await playPlaylist(deviceId, playlistId);
      logger.debug('[Spotify] Playlist playback started successfully');
    } catch (error) {
      logger.error('[Spotify] Error starting playlist playback:', error);
      setSpotifyError(
        `Failed to start playback: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }, [deviceId, playlistId]);

  // Play next track in playlist (Spotify handles random selection with shuffle)
  const playNextPlaylistTrack = useCallback(async () => {
    if (!deviceId) {
      logger.error('[Spotify] No device ID available');
      return;
    }

    try {
      // Reset tracking refs before playing new track to prevent incorrect loop detection
      previousTrackIdRef.current = '';
      previousPositionRef.current = 0;
      hasLoopedRef.current = false;

      // Set flag to indicate we're intentionally changing tracks
      isChangingTrackRef.current = true;

      logger.debug('[Spotify] Playing next track from playlist');
      await playNextTrack(deviceId);
      logger.debug('[Spotify] Next track started');

      // Clear the flag after a short delay as fallback (state listener will also clear it)
      setTimeout(() => {
        isChangingTrackRef.current = false;
      }, 2000);
    } catch (error) {
      logger.error('[Spotify] Error playing next track:', error);
      setSpotifyError(
        `Failed to play next track: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Clear flag on error
      isChangingTrackRef.current = false;
      throw error;
    }
  }, [deviceId]);

  // Load playlist ID on mount
  useEffect(() => {
    const currentPlaylistId = getSelectedPlaylistId();
    setPlaylistId(currentPlaylistId);
  }, []);

  // Stop playback immediately when game starts
  useEffect(() => {
    if (status === 'waiting' && !gameStartedRef.current) {
      // Game just started - immediately clear UI state and stop playback
      gameStartedRef.current = true;
      firstTrackPlayedRef.current = false;

      // Immediately clear UI state to show loading instead of old track
      setTrack(track);
      setCurrentPosition(0);
      setTrackDuration(0);
      setPaused(true);
      previousTrackIdRef.current = '';
      previousPositionRef.current = 0;
      hasLoopedRef.current = false;

      // Stop any current playback immediately
      logger.debug('[Spotify] Game started, stopping current playback');
      if (deviceId) {
        pausePlayback(deviceId).catch((error) => {
          logger.warn('[Spotify] Error pausing playback on game start:', error);
        });
      }

      // Reload playlist ID in case it changed
      const currentPlaylistId = getSelectedPlaylistId();
      if (currentPlaylistId !== playlistId) {
        setPlaylistId(currentPlaylistId);
      }
    } else if (status === 'notStarted' || status === 'finished') {
      // Game ended or not started, reset flags
      gameStartedRef.current = false;
      firstTrackPlayedRef.current = false;
    }
  }, [status, playlistId, deviceId]);

  // Load playlist ID from localStorage when it changes
  useEffect(() => {
    const currentPlaylistId = getSelectedPlaylistId();
    if (currentPlaylistId !== playlistId) {
      setPlaylistId(currentPlaylistId);
    }
  }, [playlistId]);

  // Play first track immediately when device is ready and game has started
  useEffect(() => {
    const _playFirstTrack = async () => {
      // Only play if:
      // 1. Device is ready
      // 2. Game has started (status is 'waiting')
      // 3. We haven't attempted to play the first track yet
      if (
        deviceId &&
        playlistId &&
        status === 'waiting' &&
        gameStartedRef.current &&
        !firstTrackPlayedRef.current
      ) {
        firstTrackPlayedRef.current = true; // Mark as attempted to prevent retries
        logger.debug('[Spotify] Device ready, starting playlist playback');
        try {
          // Stop any current playback before starting new track
          try {
            await pausePlayback(deviceId);
          } catch (error) {
            logger.warn('[Spotify] Error stopping playback before starting track:', error);
            // Non-critical error, continue anyway
          }

          // Start playlist playback with shuffle (Spotify picks random track)
          await startPlaylistPlayback();
          logger.debug('[Spotify] Playlist playback started successfully');

          // Reset listener fired flag - will be set by player_state_changed listener
          listenerFiredRef.current = false;

          // Poll current state every 500ms for up to 5 seconds to ensure UI updates
          // even if player_state_changed listener is delayed
          const pollStartTime = Date.now();
          const pollDuration = 5000; // 5 seconds
          const pollInterval = 500; // 500ms

          // Clear any existing polling
          if (statePollingRef.current) {
            clearInterval(statePollingRef.current);
          }
          if (statePollingTimeoutRef.current) {
            clearTimeout(statePollingTimeoutRef.current);
          }

          statePollingRef.current = window.setInterval(async () => {
            // Stop polling if listener has fired or if we've exceeded the duration
            if (listenerFiredRef.current || Date.now() - pollStartTime > pollDuration) {
              if (statePollingRef.current) {
                clearInterval(statePollingRef.current);
                statePollingRef.current = null;
              }
              return;
            }

            const currentPlayer = playerInstanceRef.current || player;
            if (currentPlayer) {
              try {
                const state = await currentPlayer.getCurrentState();
                if (state) {
                  logger.debug('[Spotify] Polling detected playback state, updating UI');
                  // Update UI state with current playback state
                  setActive(true);
                  setPaused(state.paused);
                  setTrack(state.track_window.current_track);
                  setCurrentPosition(state.position || 0);
                  setTrackDuration(state.track_window.current_track.duration_ms || 0);
                  previousTrackIdRef.current = state.track_window.current_track.id;
                  previousPositionRef.current = state.position || 0;
                  // Mark as fired so we stop polling
                  listenerFiredRef.current = true;
                  if (statePollingRef.current) {
                    clearInterval(statePollingRef.current);
                    statePollingRef.current = null;
                  }
                }
              } catch (error) {
                logger.error('[Spotify] Error polling playback state:', error);
              }
            }
          }, pollInterval);

          // Set timeout to stop polling after duration
          statePollingTimeoutRef.current = window.setTimeout(() => {
            if (statePollingRef.current) {
              clearInterval(statePollingRef.current);
              statePollingRef.current = null;
            }
            statePollingTimeoutRef.current = null;
          }, pollDuration);
        } catch (error) {
          logger.error('[Spotify] Error starting playlist playback:', error);
          setSpotifyError(
            `Failed to start playback: ${error instanceof Error ? error.message : 'Unknown error'}. Please try starting the game again.`
          );
          // Reset flag on error so we can retry
          firstTrackPlayedRef.current = false;
          // Clear polling on error
          if (statePollingRef.current) {
            clearInterval(statePollingRef.current);
            statePollingRef.current = null;
          }
          if (statePollingTimeoutRef.current) {
            clearTimeout(statePollingTimeoutRef.current);
            statePollingTimeoutRef.current = null;
          }
        }
      }
    };

    _playFirstTrack();

    // Cleanup polling on unmount or when dependencies change
    return () => {
      if (statePollingRef.current) {
        clearInterval(statePollingRef.current);
        statePollingRef.current = null;
      }
      if (statePollingTimeoutRef.current) {
        clearTimeout(statePollingTimeoutRef.current);
        statePollingTimeoutRef.current = null;
      }
    };
  }, [deviceId, playlistId, status, startPlaylistPlayback, player]);

  // Initialize player - reuse from lobby if available
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      logger.debug('No access token available');
      setSpotifyError(
        'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
      );
      return;
    }

    // Prevent multiple initializations
    if (playerInitializedRef.current) {
      logger.debug('[Game] Player already initialized');
      return;
    }
    playerInitializedRef.current = true;

    // Check if player is already initialized from lobby
    if (window.spotifyPlayerInstance) {
      logger.debug('[Game] Reusing player instance from lobby');
      const existingPlayer = window.spotifyPlayerInstance;
      setPlayer(existingPlayer);
      playerInstanceRef.current = existingPlayer;

      // Get deviceId from localStorage or try to get it from player
      const storedDeviceId = localStorage.getItem('spotify_device_id');
      if (storedDeviceId) {
        setDeviceId(storedDeviceId);
        setSpotifyError(null);
        setActive(true);
        hasAttemptedTransferRef.current = true;
        logger.debug('[Game] Using device ID from localStorage:', storedDeviceId);
      } else {
        // Try to get device ID from player state
        existingPlayer
          .getCurrentState()
          .then((state) => {
            if (state) {
              setActive(true);
              hasAttemptedTransferRef.current = true;
            }
          })
          .catch((error) => {
            logger.error('[Game] Error getting state from existing player:', error);
          });
      }

      // Set up listeners if not already set up (they should be, but just in case)
      // Note: Listeners from lobby should still work, but we'll add game-specific ones
      return;
    }

    // Check if script is already loaded
    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    if (existingScript && window.Spotify) {
      logger.debug('[Game] SDK script already loaded, creating new player');
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
        logger.debug('[Game] Ready with Device ID', device_id);
        setDeviceId(device_id);
        localStorage.setItem('spotify_device_id', device_id);
        setSpotifyError(null); // Clear error on successful connection

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            // If game has started, check playback state after a delay to see if playback has started
            if (gameStartedRef.current) {
              logger.debug('[Game] Game has started, checking playback state after delay');
              hasAttemptedTransferRef.current = true;
              
              // Check playback state after a short delay to see if playback has started
              setTimeout(async () => {
                try {
                  const delayedState = await spotifyPlayer.getCurrentState();
                  if (delayedState) {
                    logger.debug('[Game] Playback has started, updating UI state');
                    setActive(true);
                    setPaused(delayedState.paused);
                    setTrack(delayedState.track_window.current_track);
                    setCurrentPosition(delayedState.position || 0);
                    setTrackDuration(delayedState.track_window.current_track.duration_ms || 0);
                    previousTrackIdRef.current = delayedState.track_window.current_track.id;
                    previousPositionRef.current = delayedState.position || 0;
                  } else {
                    logger.debug('[Game] No playback state yet, waiting for player_state_changed listener');
                    // Let player_state_changed listener handle state update when playback starts
                  }
                } catch (error) {
                  logger.error('[Game] Error getting delayed state:', error);
                }
              }, 200);
              return;
            }

            if (state) {
              logger.debug('[Game] Initial state:', {
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
              logger.debug(
                '[Game] No initial playback state - device should already be ready from lobby'
              );
              setActive(false);
              setCurrentPosition(0);
              setTrackDuration(0);
              hasAttemptedTransferRef.current = true;
              // Don't attempt transfer here - should already be done in lobby
            }
          })
          .catch((error) => {
            logger.error('[Game] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        logger.debug('[Game] Device ID has gone offline', device_id);
        setActive(false);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        logger.error('[Spotify] Authentication error:', message);
        setSpotifyError(
          'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
        );
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        logger.error('[Spotify] Initialization error:', message);
        setSpotifyError(
          'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
        );
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        logger.error('[Spotify] Account error:', message);
        setSpotifyError(
          'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
        );
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        // Mark that listener has fired - stop polling
        listenerFiredRef.current = true;

        if (!state) {
          logger.debug(
            '[Spotify] Player state changed: null state - playback may have been transferred away'
          );
          setActive(false);
          setTrack(track);
          setCurrentPosition(0);
          setTrackDuration(0);
          previousTrackIdRef.current = '';
          hasLoopedRef.current = false;
          isChangingTrackRef.current = false;
          return;
        }

        logger.debug('[Spotify] Player state changed:', {
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
          // New track started - clear last song and enable repeat mode
          logger.debug('[Spotify] New track started, clearing last song and enabling repeat mode');
          setLastSong(null);
          sendLastSongChangedAction(null);
          previousTrackIdRef.current = newTrackId;
          hasLoopedRef.current = false;
          previousPositionRef.current = position;
          // Clear the track changing flag since we've detected the change
          isChangingTrackRef.current = false;
          // Enable repeat mode only once when track change is detected
          enableRepeatMode(newTrackId);

          // If autoplay is OFF and we have a pending pause, pause the track
          if (pendingPauseRef.current && !state.paused) {
            logger.debug('[Spotify] Autoplay is OFF, pausing new track');
            pendingPauseRef.current = false;
            const currentPlayer = playerInstanceRef.current;
            if (currentPlayer) {
              currentPlayer.togglePlay().catch((error) => {
                logger.error('[Host Game] Error pausing after track change:', error);
              });
            }
            // Update state to reflect pause and new track
            setPaused(true);
            setTrack(state.track_window.current_track);
            setCurrentPosition(position);
            setTrackDuration(duration);
            setActive(true);
            return;
          }
        } else if (previousTrackIdRef.current === '') {
          // First time we see this track - enable repeat mode
          previousTrackIdRef.current = newTrackId;
          hasLoopedRef.current = false;
          previousPositionRef.current = position;
          // Clear the track changing flag if it was set
          isChangingTrackRef.current = false;
          enableRepeatMode(newTrackId);
        } else {
          // Same track - check if it looped (position jumped from near end to near start)
          // Only check for loops if we're not intentionally changing tracks
          if (
            !isChangingTrackRef.current &&
            duration > 0 &&
            previousPosition > duration * 0.8 && // Was near the end (>80%)
            position < duration * 0.1 && // Now near the start (<10%)
            !hasLoopedRef.current // Haven't detected loop yet
          ) {
            // Song looped - award partial points if any players partially guessed, then save as last song and pause
            logger.debug(
              '[Spotify] Song looped (second time started), awarding partial points and pausing'
            );
            // Award 0.5 points to partially guessed players if the round ended without a correct guess
            awardPartialPointsIfRoundEnded(gameContext);
            saveLastSong(state.track_window.current_track);
            hasLoopedRef.current = true;
            if (!state.paused) {
              const currentPlayer = playerInstanceRef.current;
              if (currentPlayer) {
                currentPlayer.togglePlay().catch((error) => {
                  logger.error('[Host Game] Error pausing after loop:', error);
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

        // Update state normally - always update track, position, duration, paused, and active
        setTrack(state.track_window.current_track);
        setCurrentPosition(position);
        setTrackDuration(duration);
        setPaused(state.paused);
        setActive(true);
        // Update previous position ref
        previousPositionRef.current = position;
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
        logger.debug('[Game] Ready with Device ID', device_id);
        setDeviceId(device_id);
        localStorage.setItem('spotify_device_id', device_id);
        setSpotifyError(null); // Clear error on successful connection

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            // If game has started, check playback state after a delay to see if playback has started
            if (gameStartedRef.current) {
              logger.debug('[Game] Game has started, checking playback state after delay');
              hasAttemptedTransferRef.current = true;
              
              // Check playback state after a short delay to see if playback has started
              setTimeout(async () => {
                try {
                  const delayedState = await spotifyPlayer.getCurrentState();
                  if (delayedState) {
                    logger.debug('[Game] Playback has started, updating UI state');
                    setActive(true);
                    setPaused(delayedState.paused);
                    setTrack(delayedState.track_window.current_track);
                    setCurrentPosition(delayedState.position || 0);
                    setTrackDuration(delayedState.track_window.current_track.duration_ms || 0);
                    previousTrackIdRef.current = delayedState.track_window.current_track.id;
                    previousPositionRef.current = delayedState.position || 0;
                  } else {
                    logger.debug('[Game] No playback state yet, waiting for player_state_changed listener');
                    // Let player_state_changed listener handle state update when playback starts
                  }
                } catch (error) {
                  logger.error('[Game] Error getting delayed state:', error);
                }
              }, 200);
              return;
            }

            if (state) {
              logger.debug('[Game] Initial state:', {
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
              logger.debug(
                '[Game] No initial playback state - device should already be ready from lobby'
              );
              setActive(false);
              setCurrentPosition(0);
              setTrackDuration(0);
              hasAttemptedTransferRef.current = true;
              // Don't attempt transfer here - should already be done in lobby
            }
          })
          .catch((error) => {
            logger.error('[Game] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        logger.debug('[Game] Device ID has gone offline', device_id);
        setActive(false);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        logger.error('[Spotify] Authentication error:', message);
        setSpotifyError(
          'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
        );
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        logger.error('[Spotify] Initialization error:', message);
        setSpotifyError(
          'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
        );
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        logger.error('[Spotify] Account error:', message);
        setSpotifyError(
          'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
        );
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        // Mark that listener has fired - stop polling
        listenerFiredRef.current = true;

        if (!state) {
          logger.debug(
            '[Spotify] Player state changed: null state - playback may have been transferred away'
          );
          setActive(false);
          setTrack(track);
          setCurrentPosition(0);
          setTrackDuration(0);
          previousTrackIdRef.current = '';
          hasLoopedRef.current = false;
          isChangingTrackRef.current = false;
          return;
        }

        logger.debug('[Spotify] Player state changed:', {
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
          // New track started - clear last song and enable repeat mode
          logger.debug('[Spotify] New track started, clearing last song and enabling repeat mode');
          setLastSong(null);
          sendLastSongChangedAction(null);
          previousTrackIdRef.current = newTrackId;
          hasLoopedRef.current = false;
          previousPositionRef.current = position;
          // Clear the track changing flag since we've detected the change
          isChangingTrackRef.current = false;
          // Enable repeat mode only once when track change is detected
          enableRepeatMode(newTrackId);

          // If autoplay is OFF and we have a pending pause, pause the track
          if (pendingPauseRef.current && !state.paused) {
            logger.debug('[Spotify] Autoplay is OFF, pausing new track');
            pendingPauseRef.current = false;
            const currentPlayer = playerInstanceRef.current;
            if (currentPlayer) {
              currentPlayer.togglePlay().catch((error) => {
                logger.error('[Host Game] Error pausing after track change:', error);
              });
            }
            // Update state to reflect pause and new track
            setPaused(true);
            setTrack(state.track_window.current_track);
            setCurrentPosition(position);
            setTrackDuration(duration);
            setActive(true);
            return;
          }
        } else if (previousTrackIdRef.current === '') {
          // First time we see this track - enable repeat mode
          previousTrackIdRef.current = newTrackId;
          hasLoopedRef.current = false;
          previousPositionRef.current = position;
          // Clear the track changing flag if it was set
          isChangingTrackRef.current = false;
          enableRepeatMode(newTrackId);
        } else {
          // Same track - check if it looped (position jumped from near end to near start)
          // Only check for loops if we're not intentionally changing tracks
          if (
            !isChangingTrackRef.current &&
            duration > 0 &&
            previousPosition > duration * 0.8 && // Was near the end (>80%)
            position < duration * 0.1 && // Now near the start (<10%)
            !hasLoopedRef.current // Haven't detected loop yet
          ) {
            // Song looped - award partial points if any players partially guessed, then save as last song and pause
            logger.debug(
              '[Spotify] Song looped (second time started), awarding partial points and pausing'
            );
            // Award 0.5 points to partially guessed players if the round ended without a correct guess
            awardPartialPointsIfRoundEnded(gameContext);
            saveLastSong(state.track_window.current_track);
            hasLoopedRef.current = true;
            if (!state.paused) {
              const currentPlayer = playerInstanceRef.current;
              if (currentPlayer) {
                currentPlayer.togglePlay().catch((error) => {
                  logger.error('[Host Game] Error pausing after loop:', error);
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

        // Update state normally - always update track, position, duration, paused, and active
        setTrack(state.track_window.current_track);
        setCurrentPosition(position);
        setTrackDuration(duration);
        setPaused(state.paused);
        setActive(true);
        // Update previous position ref
        previousPositionRef.current = position;
      });

      spotifyPlayer.connect();
    };

    return () => {
      // Cleanup: logout from Spotify and disconnect player when leaving game
      // Only logout if we're actually navigating away (not just re-rendering)
      // Check if we're still on a host page
      const isStillOnHostPage =
        window.location.pathname === '/host-lobby' || window.location.pathname === '/hostgame';
      if (!isStillOnHostPage) {
        logoutSpotify();
        if (playerInstanceRef.current) {
          playerInstanceRef.current.disconnect();
          playerInstanceRef.current = undefined;
        }
        if (window.spotifyPlayerInstance) {
          window.spotifyPlayerInstance = undefined;
        }
      } else {
        // Still on host page, just disconnect player
        if (playerInstanceRef.current) {
          playerInstanceRef.current.disconnect();
          playerInstanceRef.current = undefined;
        }
      }
    };
  }, [enableRepeatMode, saveLastSong, setLastSong, gameContext]);

  const handleToggleHideSong = (checked: boolean) => {
    setHideSongUntilBuzzed(checked);
    localStorage.setItem(HIDE_SONG_UNTIL_BUZZED_KEY, checked.toString());
  };

  const handleToggleAutoplay = (checked: boolean) => {
    setAutoplay(checked);
    localStorage.setItem(AUTOPLAY_KEY, checked.toString());
  };

  const handleVolumeChange = async (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem(SPOTIFY_VOLUME_KEY, newVolume.toString());
    if (player) {
      try {
        await player.setVolume(newVolume);
      } catch (error) {
        logger.error('[Spotify] Error setting volume:', error);
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
      logger.error('[Spotify] No access token or device ID available for seek');
      return;
    }

    try {
      const seekPosition = Math.floor(positionMs);
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/seek?position_ms=${seekPosition}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.status === 204) {
        logger.debug('[Spotify] Seeked to position:', seekPosition);
        setCurrentPosition(seekPosition);
        // Update previousPositionRef to the new position so position updates continue correctly
        previousPositionRef.current = seekPosition;
      } else {
        logger.error('[Spotify] Failed to seek:', response.status);
      }
    } catch (error) {
      logger.error('[Spotify] Error seeking:', error);
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
    // Check for valid track and player instead of just is_active
    if (!player || !current_track.name || trackDuration <= 0) {
      // Clear interval if no player, no track, or no duration
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
      return;
    }

    // Update position periodically (every 500ms)
    // Only update if not seeking - but continue checking even if paused
    positionUpdateIntervalRef.current = window.setInterval(async () => {
      const currentPlayer = playerInstanceRef.current || player;
      if (currentPlayer && !isSeeking) {
        try {
          const state = await currentPlayer.getCurrentState();
          if (state) {
            // Always update track state if it changed
            const currentTrackId = state.track_window.current_track.id;
            if (currentTrackId !== previousTrackIdRef.current) {
              // Track changed - update UI state
              setTrack(state.track_window.current_track);
              setTrackDuration(state.track_window.current_track.duration_ms || 0);
              setActive(true);
              previousTrackIdRef.current = currentTrackId;
            }

            // Update position if playing
            if (!state.paused) {
              const newPosition = state.position || 0;
              const currentDuration = state.track_window.current_track.duration_ms || trackDuration;
              const prevPos = previousPositionRef.current;

              // Check if song looped (position jumped from near end to near start)
              if (
                currentDuration > 0 &&
                previousTrackIdRef.current === currentTrackId &&
                prevPos > currentDuration * 0.8 && // Was near the end (>80%)
                newPosition < currentDuration * 0.1 && // Now near the start (<10%)
                !hasLoopedRef.current // Haven't detected loop yet
              ) {
                // Song looped - award partial points if any players partially guessed, then save as last song and pause
                logger.debug(
                  '[Host Game] Song looped (detected in interval), awarding partial points and pausing'
                );
                // Award 0.5 points to partially guessed players if the round ended without a correct guess
                awardPartialPointsIfRoundEnded(gameContext);
                if (state?.track_window?.current_track) {
                  saveLastSong(state.track_window.current_track);
                }
                hasLoopedRef.current = true;
                await currentPlayer.togglePlay();
                setPaused(true);
                // Show full duration
                setCurrentPosition(Math.ceil(currentDuration / 1000) * 1000);
                previousPositionRef.current = Math.ceil(currentDuration / 1000) * 1000;
              } else {
                // Update position normally
                setCurrentPosition(newPosition);
                previousPositionRef.current = newPosition;
              }
            } else {
              // Update paused state if it changed
              if (!is_paused) {
                setPaused(true);
              }
            }
          }
        } catch (error) {
          logger.error('[Host Game] Error updating position:', error);
        }
      }
    }, 500); // Check every 500ms

    return () => {
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
        positionUpdateIntervalRef.current = null;
      }
    };
  }, [isSeeking, player, current_track.name, trackDuration, is_paused, saveLastSong, gameContext]);

  // Determine layout class for track display section - always center
  const trackDisplayClass =
    current_track.name && shouldShowSong ? 'flex items-center justify-center gap-4' : '';

  // Get current guessing player (first in waiting list)
  const currentGuessingPlayer =
    waitingPlayers && waitingPlayers.length > 0 ? waitingPlayers[0] : null;

  // Handle right guess
  const handleRightGuess = useCallback(async () => {
    if (!currentGuessingPlayer) return;

    // Save current track as last song before resetting players
    if (current_track?.name) {
      saveLastSong(current_track);
    }

    markPlayerGuessedRight(gameContext, async () => {
      // Play next song from playlist
      try {
        // Set pending pause flag if autoplay is OFF
        if (!autoplay) {
          pendingPauseRef.current = true;
        }
        await playNextPlaylistTrack();
        logger.debug('[Host] Playing next song from playlist after correct guess', { autoplay });

        // If autoplay is OFF, pause immediately after a short delay
        if (!autoplay) {
          setTimeout(async () => {
            const currentPlayer = playerInstanceRef.current || player;
            if (currentPlayer) {
              try {
                const state = await currentPlayer.getCurrentState();
                if (state && !state.paused) {
                  await currentPlayer.togglePlay();
                  logger.debug('[Host] Paused next song (autoplay OFF)');
                }
              } catch (error) {
                logger.error('[Host] Error pausing after next track:', error);
              }
            }
          }, 300);
        }
      } catch (error) {
        logger.error('[Host] Error playing next song:', error);
        pendingPauseRef.current = false;
      }
    });
  }, [
    currentGuessingPlayer,
    autoplay,
    current_track,
    gameContext,
    playNextPlaylistTrack,
    player,
    saveLastSong,
  ]);

  // Handle partially right guess
  const handlePartiallyRightGuess = useCallback(async () => {
    if (!currentGuessingPlayer) return;

    markPlayerGuessedPartially(gameContext, async () => {
      // Resume current song if there are more players who can guess
      // Only auto-resume if autoplay is enabled
      if (player && is_paused && autoplay) {
        try {
          await player.togglePlay();
          console.log('[Host] Resuming song for next player after partial answer');
        } catch (error) {
          console.error('[Host] Error resuming song:', error);
        }
      }
    });
  }, [currentGuessingPlayer, gameContext, is_paused, player, autoplay]);

  // Handle wrong guess
  const handleWrongGuess = useCallback(async () => {
    if (!currentGuessingPlayer) return;

    markPlayerGuessedWrong(
      gameContext,
      async () => {
        // Resume current song
        // Only auto-resume if autoplay is enabled
        if (player && is_paused && autoplay) {
          try {
            await player.togglePlay();
            logger.debug('[Host] Resuming song for next player');
          } catch (error) {
            logger.error('[Host] Error resuming song:', error);
          }
        }
      },
      async () => {
        // Play next song from playlist if no more players can guess
        try {
          // Set pending pause flag if autoplay is OFF
          if (!autoplay) {
            pendingPauseRef.current = true;
          }
          await playNextPlaylistTrack();
          logger.debug('[Host] Playing next song from playlist - no more players can guess', {
            autoplay,
          });

          // If autoplay is OFF, pause immediately after a short delay
          if (!autoplay) {
            setTimeout(async () => {
              const currentPlayer = playerInstanceRef.current || player;
              if (currentPlayer) {
                try {
                  const state = await currentPlayer.getCurrentState();
                  if (state && !state.paused) {
                    await currentPlayer.togglePlay();
                    logger.debug('[Host] Paused next song (autoplay OFF)');
                  }
                } catch (error) {
                  logger.error('[Host] Error pausing after next track:', error);
                }
              }
            }, 300);
          }
        } catch (error) {
          logger.error('[Host] Error playing next song:', error);
          pendingPauseRef.current = false;
        }
      }
    );
  }, [currentGuessingPlayer, autoplay, gameContext, is_paused, playNextPlaylistTrack, player]);

  // Create pause function that can be called from anywhere
  const pausePlayerFunction = useCallback(async () => {
    const currentPlayer = playerInstanceRef.current || player;
    logger.debug('[Host Game] Pause function called', {
      hasPlayer: !!currentPlayer,
      playerFromRef: !!playerInstanceRef.current,
    });

    if (currentPlayer) {
      try {
        // Get current state to check if we need to pause
        const currentState = await currentPlayer.getCurrentState();
        logger.debug('[Host Game] Current playback state:', currentState);

        if (currentState && !currentState.paused) {
          logger.debug('[Host Game] Pausing playback');
          await currentPlayer.togglePlay();
          logger.debug('[Host Game] Playback paused successfully');
          // Update local state
          setPaused(true);
        } else {
          logger.debug('[Host Game] Playback is already paused or no state');
        }
      } catch (error) {
        logger.error('[Host Game] Error pausing playback:', error);
      }
    } else {
      logger.error('[Host Game] No player available in pause function');
    }
  }, [player]);

  // Register pause callback in context and global
  useEffect(() => {
    if (player && is_active) {
      logger.debug('[Host Game] Registering pause callback', { player, is_active });
      setPausePlayerCallback(pausePlayerFunction);
      setGlobalPausePlayer(pausePlayerFunction);
    } else {
      logger.debug('[Host Game] Clearing pause callback', { player, is_active });
      setPausePlayerCallback(null);
      setGlobalPausePlayer(null);
    }
    return () => {
      setPausePlayerCallback(null);
      setGlobalPausePlayer(null);
    };
  }, [pausePlayerFunction, is_active, player, setPausePlayerCallback]);

  // Persist buzzer sound preference to localStorage and sync with audio object
  useEffect(() => {
    localStorage.setItem(BUZZER_SOUND_ENABLED_KEY, buzzerSoundEnabled.toString());
    // Sync mute state with audio object (muted when sound is disabled)
    setBuzzerSoundMuted(!buzzerSoundEnabled);
  }, [buzzerSoundEnabled]);

  // Toggle buzzer sound
  const toggleBuzzerSound = useCallback(() => {
    setBuzzerSoundEnabled((prev) => !prev);
  }, []);

  // Auto-dismiss buzzer notification after 3 seconds
  useEffect(() => {
    if (buzzerNotification) {
      const timer = setTimeout(() => {
        setBuzzerNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [buzzerNotification, setBuzzerNotification]);

  // Auto-advance to next song when no players can guess anymore
  // This handles the case where players are in no clue list and all others have guessed
  const autoAdvanceTriggeredRef = useRef(false);
  useEffect(() => {
    // Only check during active game (not in lobby or finished state)
    if (status !== 'waiting' && status !== 'listening' && status !== 'guessing') {
      autoAdvanceTriggeredRef.current = false;
      return;
    }

    // Check if no players are waiting and no players can still guess
    const hasWaitingPlayers = waitingPlayers && waitingPlayers.length > 0;
    const hasNotGuessedPlayers = notGuessedPlayers && notGuessedPlayers.length > 0;

    // If there are waiting players or players who can still guess, reset the trigger
    if (hasWaitingPlayers || hasNotGuessedPlayers) {
      autoAdvanceTriggeredRef.current = false;
      return;
    }

    // All players have either guessed, partially guessed, or are in no clue list
    // Only trigger once per round to avoid multiple advances
    if (!autoAdvanceTriggeredRef.current && players && players.length > 0) {
      autoAdvanceTriggeredRef.current = true;
      logger.info('[Host Game] No players can guess anymore - auto-advancing to next song', {
        waitingPlayers: waitingPlayers?.length || 0,
        guessedPlayers: guessedPlayers?.length || 0,
        partiallyGuessedPlayers: partiallyGuessedPlayers?.length || 0,
        noCluePlayers: noCluePlayers?.length || 0,
        notGuessedPlayers: notGuessedPlayers?.length || 0,
      });

      // Save current track as last song before resetting players
      if (current_track?.name) {
        saveLastSong(current_track);
      }

      // Reset all players (this clears both waiting and guessed lists)
      // This will also award 0.5 points to partially guessed players if there are any
      const pointsAwarded = resetAllPlayersForNewRound(gameContext);

      // If no points were awarded, send toast notification
      if (!pointsAwarded) {
        sendNoPointsToastAction();
      }

      // Play next song from playlist
      const advanceToNextSong = async () => {
        try {
          // Set pending pause flag if autoplay is OFF
          if (!autoplay) {
            pendingPauseRef.current = true;
          }
          await playNextPlaylistTrack();
          logger.debug('[Host Game] Auto-advanced to next song', { autoplay });

          // If autoplay is OFF, pause immediately after a short delay
          if (!autoplay) {
            setTimeout(async () => {
              const currentPlayer = playerInstanceRef.current || player;
              if (currentPlayer) {
                try {
                  const state = await currentPlayer.getCurrentState();
                  if (state && !state.paused) {
                    await currentPlayer.togglePlay();
                    logger.debug('[Host Game] Paused next song (autoplay OFF)');
                  }
                } catch (error) {
                  logger.error('[Host Game] Error pausing after next track:', error);
                }
              }
            }, 300);
          }
        } catch (error) {
          logger.error('[Host Game] Error auto-advancing to next song:', error);
          pendingPauseRef.current = false;
          autoAdvanceTriggeredRef.current = false; // Reset on error so it can retry
        }
      };

      // Small delay to ensure state updates are processed
      setTimeout(() => {
        advanceToNextSong();
      }, 100);
    }
  }, [
    status,
    waitingPlayers,
    notGuessedPlayers,
    players,
    guessedPlayers,
    partiallyGuessedPlayers,
    noCluePlayers,
    current_track,
    saveLastSong,
    gameContext,
    autoplay,
    playNextPlaylistTrack,
    player,
  ]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 gap-3 sm:gap-6 relative">
      {/* Buzzer sound toggle button in upper right corner */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleBuzzerSound();
        }}
        className="absolute top-2 right-2 sm:top-4 sm:right-4 btn btn-circle btn-xs sm:btn-sm bg-base-100/90 hover:bg-base-100 border border-base-300 shadow-lg z-50 pointer-events-auto"
        aria-label={buzzerSoundEnabled ? 'Disable buzzer sound' : 'Enable buzzer sound'}
        title={buzzerSoundEnabled ? 'Disable buzzer sound' : 'Enable buzzer sound'}
      >
        {buzzerSoundEnabled ? (
          // Speaker icon (sound enabled)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-4 h-4 sm:w-5 sm:h-5"
            aria-hidden="true"
          >
            <title>Speaker icon</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
            />
          </svg>
        ) : (
          // Speaker muted icon (sound disabled)
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-4 h-4 sm:w-5 sm:h-5 opacity-60"
            aria-hidden="true"
          >
            <title>Speaker muted icon</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18"
              style={{ opacity: 0.75 }}
            />
          </svg>
        )}
      </button>

      {buzzerNotification && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-info shadow-2xl">
            <span>
              <strong>{buzzerNotification.playerName}</strong> pressed the buzzer!
            </span>
          </div>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-3 sm:gap-6">
        <Card className="w-full" bodyClassName="flex flex-col gap-2 sm:gap-4">
          <div className={trackDisplayClass}>
            {current_track.name ? (
              shouldShowSong ? (
                <>
                  <img
                    src={current_track.album.images[0]?.url}
                    alt={current_track.name}
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl shadow-lg"
                  />
                  <div className="text-center">
                    <div className="font-bold text-sm sm:text-base md:text-lg">
                      {current_track.name}
                    </div>
                    <div className="text-xs sm:text-sm text-base-content/70">
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
                <div className="w-full text-xs sm:text-sm text-base-content/60 text-center">
                  Song hidden - waiting for player guess...
                </div>
              )
            ) : (
              <div className="w-full text-xs sm:text-sm text-base-content/60 text-center">
                No track playing
              </div>
            )}
          </div>
        </Card>

        <Card className="w-full" bodyClassName="flex flex-col gap-2 sm:gap-3">
          {spotifyError ? (
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="alert alert-error">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="stroke-current shrink-0 h-5 w-5 sm:h-6 sm:w-6"
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
                  <h3 className="font-bold text-sm sm:text-base">Spotify Connection Error</h3>
                  <div className="text-xs sm:text-sm">{spotifyError}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm sm:btn-md"
                onClick={() => {
                  // Disconnect Spotify player instance from Game.tsx
                  if (playerInstanceRef.current) {
                    try {
                      playerInstanceRef.current.disconnect();
                      playerInstanceRef.current = undefined;
                      logger.info('[Host Game] Disconnected Spotify player instance');
                    } catch (error) {
                      logger.error('[Host Game] Error disconnecting Spotify player:', error);
                    }
                  }
                  // End game (disconnects Spotify, sends delete-session, closes WebSocket)
                  endGame();
                  navigate('/host-lobby');
                }}
              >
                Back to Lobby
              </button>
            </div>
          ) : !player || !deviceId ? (
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="alert alert-warning">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-5 h-5 sm:w-6 sm:h-6"
                  role="img"
                  aria-label="Warning icon"
                >
                  <title>Warning icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Device Not Ready</h3>
                  <div className="text-xs sm:text-sm">
                    The Spotify device should have been set up in the lobby. Please go back to the
                    lobby and ensure the device is ready.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm sm:btn-md"
                onClick={() => {
                  // Disconnect Spotify player instance from Game.tsx
                  if (playerInstanceRef.current) {
                    try {
                      playerInstanceRef.current.disconnect();
                      playerInstanceRef.current = undefined;
                      logger.info('[Host Game] Disconnected Spotify player instance');
                    } catch (error) {
                      logger.error('[Host Game] Error disconnecting Spotify player:', error);
                    }
                  }
                  // End game (disconnects Spotify, sends delete-session, closes WebSocket)
                  endGame();
                  navigate('/host-lobby');
                }}
              >
                Back to Lobby
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:gap-3">
              {/* Timeline - visible when track and duration are available */}
              {current_track.name && trackDuration > 0 && (
                <div className="flex flex-col gap-1.5 sm:gap-2">
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

              {/* Settings toggle button */}
              <button
                type="button"
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="btn btn-sm btn-ghost w-full justify-start py-1 sm:py-2"
              >
                <span>{settingsExpanded ? '▲' : '▼'}</span>
                <span className="ml-2 text-xs sm:text-sm">Settings</span>
              </button>

              {/* Collapsible settings */}
              {settingsExpanded && (
                <>
                  <label className="label cursor-pointer py-1 sm:py-2">
                    <span className="label-text text-xs sm:text-sm">
                      Hide song until player guesses
                    </span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm sm:toggle-md"
                      checked={hideSongUntilBuzzed}
                      onChange={(e) => handleToggleHideSong(e.target.checked)}
                    />
                  </label>

                  <label className="label cursor-pointer py-1 sm:py-2">
                    <span className="label-text text-xs sm:text-sm">Autoplay</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm sm:toggle-md"
                      checked={autoplay}
                      onChange={(e) => handleToggleAutoplay(e.target.checked)}
                    />
                  </label>
                </>
              )}

              <div className="divider my-0"></div>

              <div className="flex gap-1.5 sm:gap-2">
                <button
                  type="button"
                  className={`flex-1 btn-sm sm:btn-md md:btn-lg ${!autoplay && is_paused ? 'btn btn-success animate-pulse' : 'btn btn-warning'}`}
                  onClick={async () => {
                    if (!player) {
                      logger.error('[Spotify] Player not available');
                      return;
                    }
                    try {
                      logger.debug('[Spotify] Toggling play, current paused state:', is_paused);
                      logger.debug('[Spotify] Current track:', current_track.name || 'No track');
                      logger.debug('[Spotify] Player active:', is_active);
                      logger.debug('[Spotify] Has looped:', hasLoopedRef.current);

                      // Check current state before toggling
                      const currentState = await player.getCurrentState();
                      logger.debug('[Spotify] Current state before toggle:', {
                        hasState: !!currentState,
                        paused: currentState?.paused,
                        track: currentState?.track_window.current_track.name,
                      });

                      if (!currentState) {
                        logger.warn(
                          '[Spotify] No active playback state. Make sure playback is transferred to this device and a track is loaded.'
                        );
                        alert(
                          'No active playback. Please transfer playback to "Guess The Song" from another Spotify client and ensure a track is loaded.'
                        );
                        return;
                      }

                      // If song has looped and is paused, jump to start (0:00) and reset loop tracking
                      if (hasLoopedRef.current && is_paused) {
                        logger.debug(
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
                            logger.debug('[Spotify] Jumped to start successfully');
                          } catch (seekError) {
                            logger.error('[Spotify] Error seeking to start:', seekError);
                          }
                        }
                      }

                      await player.togglePlay();
                      logger.debug('[Spotify] togglePlay() called successfully');

                      // Check state after a short delay
                      setTimeout(async () => {
                        const newState = await player.getCurrentState();
                        logger.debug('[Spotify] State after toggle:', {
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
                      logger.error('[Spotify] Error toggling play:', error);
                      alert(
                        `Error controlling playback: ${error instanceof Error ? error.message : 'Unknown error'}`
                      );
                    }
                  }}
                  disabled={!player}
                >
                  {is_paused ? 'PLAY' : 'PAUSE'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline flex-1 btn-sm sm:btn-md md:btn-lg"
                  onClick={async () => {
                    // Reset all players to default list before going to next song
                    logger.debug('[Host Game] Next button clicked - resetting all players');
                    const pointsAwarded = resetAllPlayersForNewRound(gameContext);

                    // If no points were awarded, send toast notification
                    if (!pointsAwarded) {
                      sendNoPointsToastAction();
                    }

                    // Go to next track from playlist
                    try {
                      // Set pending pause flag if autoplay is OFF
                      if (!autoplay) {
                        pendingPauseRef.current = true;
                      }
                      await playNextPlaylistTrack();
                      logger.debug('[Host Game] Next track from playlist started', { autoplay });

                      // If autoplay is OFF, pause immediately after a short delay
                      if (!autoplay) {
                        setTimeout(async () => {
                          const currentPlayer = playerInstanceRef.current || player;
                          if (currentPlayer) {
                            try {
                              const state = await currentPlayer.getCurrentState();
                              if (state && !state.paused) {
                                await currentPlayer.togglePlay();
                                logger.debug('[Host Game] Paused next track (autoplay OFF)');
                              }
                            } catch (error) {
                              logger.error('[Host Game] Error pausing after next track:', error);
                            }
                          }
                        }, 300);
                      }
                    } catch (error) {
                      logger.error('[Host Game] Error going to next track:', error);
                      pendingPauseRef.current = false;
                    }
                  }}
                  disabled={!player}
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 sm:w-5 sm:h-5 shrink-0"
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
                <span className="text-xs sm:text-sm font-medium w-10 sm:w-12 text-right shrink-0">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          )}
        </Card>

        {currentGuessingPlayer && (
          <Card className="w-full" bodyClassName="flex flex-col gap-2 sm:gap-4 py-2 sm:py-4">
            <div className="text-center">
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2">
                {currentGuessingPlayer.name} is guessing
              </h2>
              <p className="text-xs sm:text-sm text-base-content/70">
                {partiallyGuessedPlayers.length > 0
                  ? 'Was the answer correct or wrong?'
                  : 'Was the answer correct, partially correct or wrong?'}
              </p>
            </div>
            <div className="flex gap-2 sm:gap-4 justify-center">
              <button
                type="button"
                className="btn btn-success btn-sm sm:btn-md md:btn-lg flex-1"
                onClick={handleRightGuess}
              >
                ✓ Correct
              </button>
              {partiallyGuessedPlayers.length === 0 && (
                <button
                  type="button"
                  className="btn btn-warning btn-sm sm:btn-md md:btn-lg flex-1"
                  onClick={handlePartiallyRightGuess}
                >
                  ~ Partially
                </button>
              )}
              <button
                type="button"
                className="btn btn-error btn-sm sm:btn-md md:btn-lg flex-1"
                onClick={handleWrongGuess}
              >
                ✗ Wrong
              </button>
            </div>
          </Card>
        )}

        <PlayersLobby
          notGuessedPlayers={notGuessedPlayers}
          waitingPlayers={waitingPlayers}
          guessedPlayers={guessedPlayers}
          partiallyGuessedPlayers={partiallyGuessedPlayers}
          noCluePlayers={noCluePlayers}
        />

        <button
          type="button"
          onClick={() => {
            endGame();
            navigate('/');
          }}
          className="btn btn-sm btn-outline btn-error"
        >
          Leave Lobby
        </button>
      </div>
    </main>
  );
}
