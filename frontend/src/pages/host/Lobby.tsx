import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackendOffline } from '../../components/BackendOffline';
import { Card } from '../../components/Card';
import GameCode from '../../components/GameCode';
import { InstallPrompt } from '../../components/InstallPrompt';
import PlayersLobby from '../../components/PlayersLobby';
import { useGameContext } from '../../game/context';
import { getStoredHostSession, startGame, useGameInitializer } from '../../game/host';
import {
  getSelectedPlaylistId,
  getUserPlaylists,
  preparePlaylistContext,
  type SpotifyPlaylist,
  setSelectedPlaylistId,
  validatePlaylistHasTracks,
} from '../../services/spotify/api';
import { handleSpotifyLogin, logoutSpotify, spotifyIsLoggedIn } from '../../services/spotify/auth';
import { DEFAULT_PLAYLIST_ID, DEFAULT_PLAYLISTS } from '../../services/spotify/playlists';
import logger from '../../utils/logger';

const SPOTIFY_VOLUME_KEY = 'spotifyVolume';

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
  position: number;
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

export default function Lobby() {
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [showCopyError, setShowCopyError] = useState(false);
  const [spotifyLoginLoading, setSpotifyLoginLoading] = useState(false);
  const [isLoggedInSpotify, setIsLoggedInSpotify] = useState(spotifyIsLoggedIn());
  const [selectedPlaylistId, setSelectedPlaylistIdState] = useState<string>(
    getSelectedPlaylistId()
  );
  const [availablePlaylists, setAvailablePlaylists] = useState<SpotifyPlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [playlistValidationLoading, setPlaylistValidationLoading] = useState(false);
  const [playlistValidationError, setPlaylistValidationError] = useState<string | null>(null);
  const hasTriedToInit = useRef(false); // Track if we've already tried to initialize
  const navigate = useNavigate();
  const gameContext = useGameContext();
  const { players, sessionId, status, isHost, setIsHost, wsStatus } = gameContext;
  const isGameRunning = status !== 'notStarted' && status !== 'finished';
  const { initGame, endGame } = useGameInitializer();

  // Spotify player state
  const [player, setPlayer] = useState<SpotifyPlayer | undefined>(undefined);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [playlistPrepared, setPlaylistPrepared] = useState(false);
  const playerInitializedRef = useRef(false);
  const playerInstanceRef = useRef<SpotifyPlayer | undefined>(undefined);
  const hasAttemptedTransferRef = useRef(false);

  // Check Spotify login status periodically
  useEffect(() => {
    const checkSpotifyStatus = () => {
      setIsLoggedInSpotify(spotifyIsLoggedIn());
    };

    checkSpotifyStatus();
    const interval = setInterval(checkSpotifyStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch user playlists when Spotify is connected
  useEffect(() => {
    if (isLoggedInSpotify && sessionId) {
      const fetchPlaylists = async () => {
        setPlaylistsLoading(true);
        setPlaylistsError(null);
        try {
          const playlists = await getUserPlaylists();
          setAvailablePlaylists(playlists);
        } catch (error) {
          console.error('Error fetching playlists:', error);
          setPlaylistsError(error instanceof Error ? error.message : 'Failed to fetch playlists');
        } finally {
          setPlaylistsLoading(false);
        }
      };

      fetchPlaylists();
    } else {
      setAvailablePlaylists([]);
    }
  }, [isLoggedInSpotify, sessionId]);

  // Validate playlist has tracks when playlist is selected
  useEffect(() => {
    if (isLoggedInSpotify && selectedPlaylistId) {
      const validatePlaylist = async () => {
        setPlaylistValidationLoading(true);
        setPlaylistValidationError(null);
        try {
          logger.debug('[Lobby] Validating playlist has tracks:', selectedPlaylistId);
          const hasTracks = await validatePlaylistHasTracks(selectedPlaylistId);
          if (!hasTracks) {
            logger.warn('[Lobby] Playlist has no tracks');
            setPlaylistValidationError('Selected playlist has no tracks');
          } else {
            logger.debug('[Lobby] Playlist validated successfully');
          }
        } catch (error) {
          logger.error('[Lobby] Error validating playlist:', error);
          setPlaylistValidationError(
            error instanceof Error ? error.message : 'Failed to validate playlist'
          );
        } finally {
          setPlaylistValidationLoading(false);
        }
      };

      validatePlaylist();
    }
  }, [isLoggedInSpotify, selectedPlaylistId]);

  // Handle playlist selection change
  const handlePlaylistChange = (playlistId: string) => {
    setSelectedPlaylistIdState(playlistId);
    setSelectedPlaylistId(playlistId);
    // Reset validation error when changing playlist
    setPlaylistValidationError(null);
  };

  const handleSpotifyLoginClick = async () => {
    setSpotifyLoginLoading(true);
    try {
      await handleSpotifyLogin();
    } catch (error) {
      logger.error('Spotify login error:', error);
      setSpotifyLoginLoading(false);
    }
  };

  const handleSpotifyLogout = () => {
    if (window.confirm('Are you sure you want to logout from Spotify?')) {
      // Disconnect player if it exists
      if (playerInstanceRef.current) {
        playerInstanceRef.current.disconnect();
        playerInstanceRef.current = undefined;
      }
      if (window.spotifyPlayerInstance) {
        window.spotifyPlayerInstance = undefined;
      }
      setPlayer(undefined);
      setDeviceId(undefined);
      setIsActive(false);
      setPlaylistPrepared(false);
      playerInitializedRef.current = false;
      hasAttemptedTransferRef.current = false;
      logoutSpotify();
      setIsLoggedInSpotify(false);
    }
  };

  // Prepare playlist context when device is ready
  const preparePlaylist = useCallback(async (targetDeviceId: string, playlistId: string) => {
    if (!targetDeviceId || !playlistId) {
      return;
    }

    try {
      logger.debug('[Lobby] Preparing playlist context:', playlistId);
      await preparePlaylistContext(targetDeviceId, playlistId);
      setPlaylistPrepared(true);
      logger.debug('[Lobby] Playlist prepared successfully');
    } catch (error) {
      logger.error('[Lobby] Error preparing playlist:', error);
      setPlaylistPrepared(false);
    }
  }, []);

  // Transfer playback to this device using Spotify Web API
  const transferPlaybackToDevice = useCallback(
    async (targetDeviceId: string, spotifyPlayerInstance?: SpotifyPlayer) => {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        logger.error('[Lobby] No access token available for transfer');
        return;
      }

      setIsTransferring(true);
      try {
        logger.debug('[Lobby] Transferring playback to device:', targetDeviceId);
        const response = await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_ids: [targetDeviceId],
            play: false, // Don't auto-play
          }),
        });

        if (response.status === 204) {
          logger.debug('[Lobby] Playback transferred successfully');
          // Wait a bit for the state to update
          setTimeout(() => {
            const playerToCheck = spotifyPlayerInstance || player;
            playerToCheck
              ?.getCurrentState()
              .then((state) => {
                if (state) {
                  setIsActive(true);
                  // Prepare playlist after successful transfer
                  const currentPlaylistId = getSelectedPlaylistId();
                  if (currentPlaylistId) {
                    preparePlaylist(targetDeviceId, currentPlaylistId);
                  }
                }
              })
              .catch((error) => {
                logger.error('[Lobby] Error getting state after transfer:', error);
              });
          }, 1000);
        } else if (response.status === 404) {
          logger.warn('[Lobby] No active device found to transfer from');
          // This is okay - user needs to start playback on another device first
        } else {
          const errorData = await response.json().catch(() => ({}));
          logger.error('[Lobby] Failed to transfer playback:', response.status, errorData);
        }
      } catch (error) {
        logger.error('[Lobby] Error transferring playback:', error);
      } finally {
        setIsTransferring(false);
      }
    },
    [player, preparePlaylist]
  );

  // If someone comes to /host-lobby, they are the host
  useEffect(() => {
    if (!isHost) {
      setIsHost(true);
    }
  }, [isHost, setIsHost]);

  useEffect(() => {
    // Don't try to init if we already have a session
    if (sessionId) return;

    // Only init once - let the initGame function handle retries internally
    if (hasTriedToInit.current) return;

    hasTriedToInit.current = true;

    // Check for stored session data for reconnection
    const storedSession = getStoredHostSession();
    if (storedSession) {
      logger.debug('[Lobby] Found stored session, attempting to reconnect', {
        sessionId: storedSession.sessionId,
        hostId: storedSession.hostId,
      });
      initGame(storedSession.sessionId, storedSession.hostId);
    } else {
      logger.debug('[Lobby] No stored session found, creating new session');
      initGame();
    }
  }, [sessionId, initGame]);

  // Reset the flag when we successfully get a session or when component unmounts
  useEffect(() => {
    if (sessionId) {
      hasTriedToInit.current = false;
    }
  }, [sessionId]);

  // Initialize Spotify player when logged in
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !isLoggedInSpotify) {
      // Clean up if logged out
      if (playerInstanceRef.current) {
        playerInstanceRef.current.disconnect();
        playerInstanceRef.current = undefined;
      }
      if (window.spotifyPlayerInstance) {
        window.spotifyPlayerInstance = undefined;
      }
      setPlayer(undefined);
      setDeviceId(undefined);
      setIsActive(false);
      setPlaylistPrepared(false);
      playerInitializedRef.current = false;
      hasAttemptedTransferRef.current = false;
      return;
    }

    // Prevent multiple initializations
    if (playerInitializedRef.current) {
      logger.debug('[Lobby] Player already initialized');
      return;
    }
    playerInitializedRef.current = true;

    // Check if script is already loaded
    const existingScript = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    if (existingScript && window.Spotify) {
      logger.debug('[Lobby] SDK script already loaded');
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
      playerInstanceRef.current = spotifyPlayer;
      window.spotifyPlayerInstance = spotifyPlayer;

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        logger.debug('[Lobby] Ready with Device ID', device_id);
        setDeviceId(device_id);
        localStorage.setItem('spotify_device_id', device_id);
        setSpotifyError(null);

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            if (state) {
              logger.debug('[Lobby] Initial state exists, device is active');
              setIsActive(true);
              hasAttemptedTransferRef.current = true;
              // Prepare playlist if we have one selected
              if (selectedPlaylistId) {
                preparePlaylist(device_id, selectedPlaylistId);
              }
            } else {
              logger.debug('[Lobby] No initial playback state, attempting transfer');
              setIsActive(false);
              if (!hasAttemptedTransferRef.current) {
                hasAttemptedTransferRef.current = true;
                setTimeout(() => {
                  transferPlaybackToDevice(device_id, spotifyPlayer);
                }, 1500);
              }
            }
          })
          .catch((error) => {
            logger.error('[Lobby] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        logger.debug('[Lobby] Device ID has gone offline', device_id);
        setIsActive(false);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        logger.error('[Lobby] Authentication error:', message);
        setSpotifyError('Something went wrong with the Spotify connection. Please reconnect.');
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        logger.error('[Lobby] Initialization error:', message);
        setSpotifyError('Something went wrong with the Spotify connection. Please reconnect.');
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        logger.error('[Lobby] Account error:', message);
        setSpotifyError('Something went wrong with the Spotify connection. Please reconnect.');
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (state) {
          setIsActive(true);
        } else {
          setIsActive(false);
        }
      });

      spotifyPlayer.connect();
      return;
    }

    // Load SDK script if not already loaded
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
      playerInstanceRef.current = spotifyPlayer;
      window.spotifyPlayerInstance = spotifyPlayer;

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        logger.debug('[Lobby] Ready with Device ID', device_id);
        setDeviceId(device_id);
        localStorage.setItem('spotify_device_id', device_id);
        setSpotifyError(null);

        // Check initial state when ready
        spotifyPlayer
          .getCurrentState()
          .then((state) => {
            if (state) {
              logger.debug('[Lobby] Initial state exists, device is active');
              setIsActive(true);
              hasAttemptedTransferRef.current = true;
              // Prepare playlist if we have one selected
              if (selectedPlaylistId) {
                preparePlaylist(device_id, selectedPlaylistId);
              }
            } else {
              logger.debug('[Lobby] No initial playback state, attempting transfer');
              setIsActive(false);
              if (!hasAttemptedTransferRef.current) {
                hasAttemptedTransferRef.current = true;
                setTimeout(() => {
                  transferPlaybackToDevice(device_id, spotifyPlayer);
                }, 1500);
              }
            }
          })
          .catch((error) => {
            logger.error('[Lobby] Error getting initial state:', error);
          });
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        logger.debug('[Lobby] Device ID has gone offline', device_id);
        setIsActive(false);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        logger.error('[Lobby] Authentication error:', message);
        setSpotifyError('Something went wrong with the Spotify connection. Please reconnect.');
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        logger.error('[Lobby] Initialization error:', message);
        setSpotifyError('Something went wrong with the Spotify connection. Please reconnect.');
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        logger.error('[Lobby] Account error:', message);
        setSpotifyError('Something went wrong with the Spotify connection. Please reconnect.');
      });

      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (state) {
          setIsActive(true);
        } else {
          setIsActive(false);
        }
      });

      spotifyPlayer.connect();
    };

    return () => {
      // Cleanup: logout from Spotify and disconnect player when leaving lobby
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
      }
    };
  }, [isLoggedInSpotify, selectedPlaylistId, transferPlaybackToDevice, preparePlaylist]);

  // Re-prepare playlist when selection changes (if device is already ready)
  useEffect(() => {
    if (deviceId && selectedPlaylistId && isActive) {
      setPlaylistPrepared(false);
      preparePlaylist(deviceId, selectedPlaylistId);
    }
  }, [selectedPlaylistId, deviceId, isActive, preparePlaylist]);

  const handleCopyLink = () => {
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  };

  const handleCopyError = () => {
    setShowCopyError(true);
    setTimeout(() => setShowCopyError(false), 4000);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-2 sm:p-4 gap-3 sm:gap-6">
      {/* ...existing connection status UI... */}
      {wsStatus === 'connecting' || wsStatus === 'closed' ? (
        <div className="alert alert-warning max-w-md flex flex-col gap-2">
          <div>
            <span className="loading loading-spinner loading-sm mr-2"></span>
            <span className="font-semibold text-sm sm:text-base">Establishing connection...</span>
          </div>
          <p className="text-xs sm:text-sm">
            Please wait while the connection to the server is being established.
          </p>
        </div>
      ) : wsStatus === 'failed' ? (
        <BackendOffline onReload={() => window.location.reload()} onBack={() => navigate('/')} />
      ) : sessionId ? (
        <>
          {/* Spotify Integration */}
          <Card className="w-full max-w-md" bodyClassName="items-center gap-2 sm:gap-3">
            {isLoggedInSpotify ? (
              <div className="w-full flex flex-col gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-3 w-full justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-success text-sm sm:text-base">✓</span>
                    <span className="font-medium text-xs sm:text-sm">Connected to Spotify</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-error btn-xs sm:btn-sm"
                    onClick={handleSpotifyLogout}
                  >
                    Logout
                  </button>
                </div>

                {/* Playlist Selection */}
                <div className="w-full flex flex-col gap-1.5 sm:gap-2">
                  <label htmlFor="playlist-select" className="label py-1">
                    <span className="label-text font-medium text-xs sm:text-sm">
                      Select Playlist
                    </span>
                  </label>
                  {playlistsLoading ? (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/70">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span>Loading playlists...</span>
                    </div>
                  ) : playlistsError ? (
                    <div className="alert alert-warning py-1.5 sm:py-2">
                      <span className="text-xs sm:text-sm">{playlistsError}</span>
                    </div>
                  ) : (
                    <select
                      id="playlist-select"
                      className="select select-bordered w-full select-sm sm:select-md text-xs sm:text-sm"
                      value={selectedPlaylistId}
                      onChange={(e) => handlePlaylistChange(e.target.value)}
                      disabled={playlistValidationLoading}
                    >
                      {/* Default playlists first */}
                      {DEFAULT_PLAYLISTS.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name} (Default)
                        </option>
                      ))}
                      {/* User playlists */}
                      {availablePlaylists
                        .filter((p) => !DEFAULT_PLAYLISTS.some((dp) => dp.id === p.id))
                        .map((playlist) => (
                          <option key={playlist.id} value={playlist.id}>
                            {playlist.name}
                          </option>
                        ))}
                      {/* Show selected playlist even if not in lists yet (in case it's the default) */}
                      {!availablePlaylists.some((p) => p.id === selectedPlaylistId) &&
                        !DEFAULT_PLAYLISTS.some((dp) => dp.id === selectedPlaylistId) && (
                          <option value={selectedPlaylistId}>
                            {selectedPlaylistId === DEFAULT_PLAYLIST_ID
                              ? 'Erkennst du den Song? (Default)'
                              : `Playlist ${selectedPlaylistId}`}
                          </option>
                        )}
                    </select>
                  )}
                  {/* Playlist validation indicator */}
                  {playlistValidationLoading && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-base-content/70">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span>Validating playlist...</span>
                    </div>
                  )}
                  {playlistValidationError && !playlistValidationLoading && (
                    <div className="alert alert-warning py-1.5 sm:py-2">
                      <span className="text-xs sm:text-sm">{playlistValidationError}</span>
                    </div>
                  )}
                </div>

                {/* Spotify Device Status */}
                {spotifyError ? (
                  <div className="alert alert-error py-1.5 sm:py-2">
                    <span className="text-xs sm:text-sm">{spotifyError}</span>
                  </div>
                ) : !isActive ? (
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="alert alert-info py-1.5 sm:py-2">
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm">Ready to play!</h3>
                        <div className="text-xs sm:text-sm">
                          {isTransferring
                            ? 'Transferring playback...'
                            : 'Playback will be transferred automatically, or you can transfer manually from another Spotify device.'}
                        </div>
                      </div>
                    </div>
                    {!isTransferring && deviceId && (
                      <button
                        type="button"
                        className="btn btn-primary btn-xs sm:btn-sm"
                        onClick={() => transferPlaybackToDevice(deviceId, player)}
                      >
                        Transfer Playback Now
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="alert alert-success py-1.5 sm:py-2">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm">Device Ready</h3>
                      <div className="text-xs sm:text-sm">
                        {playlistPrepared
                          ? 'Playlist prepared and ready to start!'
                          : 'Preparing playlist...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className={`btn btn-success w-full btn-sm sm:btn-md ${spotifyLoginLoading ? 'loading' : ''}`}
                onClick={handleSpotifyLoginClick}
                disabled={spotifyLoginLoading}
              >
                {spotifyLoginLoading ? 'Logging in...' : 'Connect to Spotify'}
              </button>
            )}
          </Card>

          <GameCode
            sessionId={sessionId}
            showCopyLink={true}
            onCopy={handleCopyLink}
            onCopyError={handleCopyError}
          />

          <PlayersLobby
            notGuessedPlayers={[...(players || [])].sort((a, b) => b.points - a.points)}
            minPlayers={2}
          />

          {showCopiedToast && (
            <div className="toast toast-top toast-center">
              <div className="alert alert-success">
                <span>✓ Link copied!</span>
              </div>
            </div>
          )}

          {showCopyError && (
            <div className="toast toast-top toast-center">
              <div className="alert alert-error">
                <span>❌ Copy not supported. Share the code with your friends!</span>
              </div>
            </div>
          )}

          {/* Game control buttons */}
          <div className="w-full max-w-md flex flex-col gap-2 sm:gap-3 mt-2 sm:mt-4">
            <button
              type="button"
              onClick={() => {
                if (players.length >= 2 && isLoggedInSpotify) {
                  if (!isGameRunning) {
                    // Start the game and broadcast to all players
                    const success = startGame(gameContext);
                    if (!success) {
                      // Handle broadcast failure - show error message
                      alert('Failed to start game. Please check your connection and try again.');
                      return;
                    }
                  }
                  navigate('/hostgame');
                }
              }}
              className={`btn btn-sm sm:btn-md md:btn-lg w-full ${
                isGameRunning ? 'btn-primary' : 'btn-success'
              } ${players.length < 2 || !isLoggedInSpotify || !isActive || !playlistPrepared ? 'btn-disabled' : ''}`}
              disabled={players.length < 2 || !isLoggedInSpotify || !isActive || !playlistPrepared}
            >
              {isGameRunning ? '💾 Save & Return' : '🎮 Start Game'}
            </button>

            <button
              type="button"
              onClick={() => {
                // Logout from Spotify when leaving
                logoutSpotify();
                // Disconnect Spotify player instance from Lobby.tsx
                if (playerInstanceRef.current) {
                  try {
                    playerInstanceRef.current.disconnect();
                    playerInstanceRef.current = undefined;
                    logger.info('[Host Lobby] Disconnected Spotify player instance');
                  } catch (error) {
                    logger.error('[Host Lobby] Error disconnecting Spotify player:', error);
                  }
                }
                if (window.spotifyPlayerInstance) {
                  try {
                    window.spotifyPlayerInstance.disconnect();
                    window.spotifyPlayerInstance = undefined;
                    logger.info('[Host Lobby] Disconnected Spotify player instance from window');
                  } catch (error) {
                    logger.error(
                      '[Host Lobby] Error disconnecting Spotify player from window:',
                      error
                    );
                  }
                }
                // End game (disconnects Spotify, sends delete-session, closes WebSocket)
                endGame();
                navigate('/');
              }}
              className="btn btn-outline btn-error btn-sm sm:btn-md"
            >
              Cancel & Leave
            </button>
          </div>
        </>
      ) : null}
      <InstallPrompt />
    </main>
  );
}
