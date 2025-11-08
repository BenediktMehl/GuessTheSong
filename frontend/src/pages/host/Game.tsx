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
import {
  getPlaylistTracks,
  getSelectedPlaylistId,
  playRandomPlaylistTrack,
  type SpotifyTrack,
} from '../../services/spotify/api';
import logger from '../../utils/logger';

const HIDE_SONG_UNTIL_BUZZED_KEY = 'hostHideSongUntilBuzzed';
const SPOTIFY_VOLUME_KEY = 'spotifyVolume';
const AUTOPLAY_KEY = 'hostAutoplay';

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
  const pendingPauseRef = useRef(false); // Track if we need to pause after track change
  const [hideSongUntilBuzzed, setHideSongUntilBuzzed] = useState<boolean>(() => {
    const stored = localStorage.getItem(HIDE_SONG_UNTIL_BUZZED_KEY);
    return stored === 'true';
  });
  const [autoplay, setAutoplay] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTOPLAY_KEY);
    return stored === null ? true : stored === 'true'; // Default to true if not set
  });
  const [volume, setVolume] = useState<number>(() => {
    const stored = localStorage.getItem(SPOTIFY_VOLUME_KEY);
    return stored ? parseFloat(stored) : 0.5;
  });
  const [currentPosition, setCurrentPosition] = useState<number>(0); // Current playback position in milliseconds
  const [trackDuration, setTrackDuration] = useState<number>(0); // Track duration in milliseconds
  const [isSeeking, setIsSeeking] = useState<boolean>(false); // Track if user is actively seeking
  const positionUpdateIntervalRef = useRef<number | null>(null);

  // Playlist-related state
  const [playlistId, setPlaylistId] = useState<string>(getSelectedPlaylistId());
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set());
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const playlistTracksLoadedRef = useRef(false);
  const gameStartedRef = useRef(false);
  const firstTrackPlayedRef = useRef(false);

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

  // Load playlist tracks
  const loadPlaylistTracks = useCallback(
    async (selectedPlaylistId: string): Promise<SpotifyTrack[]> => {
      if (playlistTracksLoadedRef.current && playlistTracks.length > 0) {
        logger.debug('[Spotify] Playlist tracks already loaded');
        return playlistTracks;
      }

      setIsLoadingPlaylist(true);
      try {
        logger.debug('[Spotify] Loading tracks from playlist:', selectedPlaylistId);
        const tracks = await getPlaylistTracks(selectedPlaylistId);
        if (tracks.length === 0) {
          logger.warn('[Spotify] Playlist has no tracks');
          setSpotifyError('Selected playlist has no tracks. Please select a different playlist.');
          setIsLoadingPlaylist(false);
          return [];
        }
        logger.debug(`[Spotify] Loaded ${tracks.length} tracks from playlist`);
        setPlaylistTracks(tracks);
        playlistTracksLoadedRef.current = true;
        setPlayedTrackIds(new Set()); // Reset played tracks when loading new playlist
        setIsLoadingPlaylist(false);
        return tracks;
      } catch (error) {
        logger.error('[Spotify] Error loading playlist tracks:', error);
        setSpotifyError(
          `Failed to load playlist tracks: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        setIsLoadingPlaylist(false);
        return [];
      }
    },
    [playlistTracks]
  );

  // Play next track from playlist
  const playNextPlaylistTrack = useCallback(async () => {
    if (!deviceId || !playlistId) {
      logger.error('[Spotify] No device ID or playlist ID available');
      return;
    }

    // Ensure playlist tracks are loaded
    let tracksToUse = playlistTracks;
    if (tracksToUse.length === 0) {
      tracksToUse = await loadPlaylistTracks(playlistId);
    }

    if (tracksToUse.length === 0) {
      logger.error('[Spotify] No tracks available to play');
      return;
    }

    try {
      const excludeIds = Array.from(playedTrackIds);
      const playedTrack = await playRandomPlaylistTrack(
        deviceId,
        playlistId,
        tracksToUse,
        excludeIds
      );
      logger.debug('[Spotify] Playing track from playlist:', playedTrack.name);

      // Add to played tracks
      setPlayedTrackIds((prev) => new Set([...prev, playedTrack.id]));

      // Enable repeat mode for the track
      await enableRepeatMode(playedTrack.id);
    } catch (error) {
      logger.error('[Spotify] Error playing playlist track:', error);
      setSpotifyError(
        `Failed to play track: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [deviceId, playlistId, playlistTracks, playedTrackIds, loadPlaylistTracks, enableRepeatMode]);

  // Reset track history when starting a new game
  useEffect(() => {
    const currentStatus = gameContext.status;
    if (currentStatus === 'waiting' && !gameStartedRef.current) {
      // Game just started
      gameStartedRef.current = true;
      firstTrackPlayedRef.current = false;
      setPlayedTrackIds(new Set());
      // Reload playlist ID in case it changed
      const currentPlaylistId = getSelectedPlaylistId();
      if (currentPlaylistId !== playlistId) {
        setPlaylistId(currentPlaylistId);
        playlistTracksLoadedRef.current = false;
        setPlaylistTracks([]);
      }
    } else if (currentStatus === 'notStarted' || currentStatus === 'finished') {
      // Game ended or not started, reset flags
      gameStartedRef.current = false;
      firstTrackPlayedRef.current = false;
    }
  }, [gameContext.status, playlistId]);

  // Load playlist ID from localStorage on mount and when it changes
  useEffect(() => {
    const currentPlaylistId = getSelectedPlaylistId();
    if (currentPlaylistId !== playlistId) {
      setPlaylistId(currentPlaylistId);
      playlistTracksLoadedRef.current = false;
      setPlaylistTracks([]);
      setPlayedTrackIds(new Set());
    }
  }, [playlistId]);

  // Play first track when device is ready and game has started
  useEffect(() => {
    const playFirstTrack = async () => {
      // Only play if:
      // 1. Device is ready
      // 2. Game has started (status is 'waiting')
      // 3. We haven't attempted to play the first track yet
      // 4. We're not currently loading the playlist
      if (
        deviceId &&
        playlistId &&
        gameContext.status === 'waiting' &&
        gameStartedRef.current &&
        !firstTrackPlayedRef.current &&
        !isLoadingPlaylist
      ) {
        firstTrackPlayedRef.current = true; // Mark as attempted to prevent retries
        logger.debug('[Spotify] Game started, playing first track from playlist');
        try {
          // Load tracks if not already loaded
          let tracksToUse = playlistTracks;
          if (tracksToUse.length === 0) {
            tracksToUse = await loadPlaylistTracks(playlistId);
          }

          // Play first track if we have tracks
          if (tracksToUse.length > 0) {
            await playNextPlaylistTrack();
          } else {
            // No tracks available, reset flag so we can try again
            firstTrackPlayedRef.current = false;
          }
        } catch (error) {
          logger.error('[Spotify] Error playing first track:', error);
          // Reset flag on error so we can retry
          firstTrackPlayedRef.current = false;
        }
      }
    };

    playFirstTrack();
  }, [
    deviceId,
    playlistId,
    gameContext.status,
    isLoadingPlaylist,
    playlistTracks,
    loadPlaylistTracks,
    playNextPlaylistTrack,
  ]);

  // Transfer playback to this device using Spotify Web API
  const transferPlaybackToDevice = useCallback(
    async (targetDeviceId: string, spotifyPlayerInstance?: SpotifyPlayer) => {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        logger.error('[Spotify] No access token available for transfer');
        return;
      }

      setIsTransferring(true);
      try {
        logger.debug('[Spotify] Transferring playback to device:', targetDeviceId);
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
          logger.debug('[Spotify] Playback transferred successfully');
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
                logger.error('[Spotify] Error getting state after transfer:', error);
              });
          }, 1000);
        } else if (response.status === 404) {
          logger.warn('[Spotify] No active device found to transfer from');
          // This is okay - user needs to start playback on another device first
        } else {
          const errorData = await response.json().catch(() => ({}));
          logger.error('[Spotify] Failed to transfer playback:', response.status, errorData);
        }
      } catch (error) {
        logger.error('[Spotify] Error transferring playback:', error);
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
      logger.debug('No access token available');
      setSpotifyError(
        'Something went wrong with the Spotify connection. Please reconnect. Go back to the lobby and start again.'
      );
      return;
    }

    // Prevent multiple initializations
    if (playerInitializedRef.current) {
      logger.debug('[Spotify] Player already initialized');
      return;
    }
    playerInitializedRef.current = true;

    // Check if script is already loaded
    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    if (existingScript && window.Spotify) {
      logger.debug('[Spotify] SDK script already loaded');
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
        logger.debug('[Spotify] Ready with Device ID', device_id);
        setDeviceId(device_id);
        setSpotifyError(null); // Clear error on successful connection

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            if (state) {
              logger.debug('[Spotify] Initial state:', {
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
              logger.debug('[Spotify] No initial playback state');
              setActive(false);
              setCurrentPosition(0);
              setTrackDuration(0);
              if (!hasAttemptedTransferRef.current) {
                logger.debug('[Spotify] Attempting to transfer playback');
                hasAttemptedTransferRef.current = true;
                setTimeout(() => {
                  transferPlaybackToDevice(device_id, spotifyPlayer);
                }, 1500);
              }
            }
          })
          .catch((error) => {
            logger.error('[Spotify] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        logger.debug('[Spotify] Device ID has gone offline', device_id);
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
          // New track started - enable repeat mode and reset loop tracking
          logger.debug('[Spotify] New track started, enabling repeat mode');
          previousTrackIdRef.current = newTrackId;
          hasLoopedRef.current = false;
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
            previousPositionRef.current = position;
            return;
          }
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
            logger.debug('[Spotify] Song looped (second time started), pausing');
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
        logger.debug('[Spotify] Ready with Device ID', device_id);
        setDeviceId(device_id);
        setSpotifyError(null); // Clear error on successful connection

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            if (state) {
              logger.debug('[Spotify] Initial state:', {
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
              logger.debug('[Spotify] No initial playback state');
              setActive(false);
              setCurrentPosition(0);
              setTrackDuration(0);
              // Only attempt transfer once
              if (!hasAttemptedTransferRef.current) {
                logger.debug('[Spotify] Attempting to transfer playback');
                hasAttemptedTransferRef.current = true;
                // Use setTimeout to avoid calling during listener setup
                // Pass spotifyPlayer instance directly to avoid dependency issues
                setTimeout(() => {
                  transferPlaybackToDevice(device_id, spotifyPlayer);
                }, 1500);
              } else {
                logger.debug('[Spotify] Transfer already attempted, skipping');
              }
            }
          })
          .catch((error) => {
            logger.error('[Spotify] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        logger.debug('[Spotify] Device ID has gone offline', device_id);
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

      // Use ref to track previous track ID to detect track changes
      const previousTrackIdRef = { current: '' };

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) {
          logger.debug(
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
          // New track started - enable repeat mode and reset loop tracking
          logger.debug('[Spotify] New track started, enabling repeat mode');
          previousTrackIdRef.current = newTrackId;
          previousPositionRef.current = position;
          hasLoopedRef.current = false;
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
            // Update state to reflect pause
            setPaused(true);
            setTrack(state.track_window.current_track);
            setCurrentPosition(position);
            setTrackDuration(duration);
            setActive(true);
            previousPositionRef.current = position;
            return;
          }
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
            logger.debug('[Spotify] Song looped (second time started), pausing');
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
        logger.debug('[Spotify] Seeked to position:', positionMs);
        setCurrentPosition(positionMs);
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
              logger.debug('[Host Game] Song looped (detected in interval), pausing');
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
  }, [currentGuessingPlayer, player, gameContext, autoplay, playNextPlaylistTrack]);

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
  }, [currentGuessingPlayer, player, is_paused, gameContext, autoplay, playNextPlaylistTrack]);

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
              <strong>{buzzerNotification.playerName}</strong> pressed the buzzer!
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
                      {current_track.artists[0]?.name || ''}
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
                  <h3 className="font-bold">Spotify Connection Error</h3>
                  <div className="text-sm">{spotifyError}</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/settings')}
              >
                Back to Lobby
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

              <label className="label cursor-pointer">
                <span className="label-text">Autoplay</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={autoplay}
                  onChange={(e) => handleToggleAutoplay(e.target.checked)}
                />
              </label>

              <div className="divider my-0"></div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 ${!autoplay && is_paused ? 'btn btn-success animate-pulse' : 'btn btn-warning'}`}
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
                  disabled={!player || !is_active}
                >
                  {is_paused ? 'PLAY' : 'PAUSE'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={async () => {
                    // Reset all players to default list before going to next song
                    logger.debug('[Host Game] Next button clicked - resetting all players');
                    resetAllPlayersForNewRound(gameContext);

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
              <h2 className="text-xl font-bold mb-2">{currentGuessingPlayer.name} is guessing</h2>
              <p className="text-base-content/70">Was the answer correct or wrong?</p>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                className="btn btn-success btn-lg flex-1"
                onClick={handleRightGuess}
              >
                ✓ Correct
              </button>
              <button
                type="button"
                className="btn btn-error btn-lg flex-1"
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
        />
      </div>
    </main>
  );
}
