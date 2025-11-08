import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import GameCode from '../../components/GameCode';
import PlayersLobby from '../../components/PlayersLobby';
import { useGameContext } from '../../game/context';
import { startGame, useGameInitializer } from '../../game/host';
import {
  getSelectedPlaylistId,
  getUserPlaylists,
  validatePlaylistHasTracks,
  type SpotifyPlaylist,
  setSelectedPlaylistId,
} from '../../services/spotify/api';
import { handleSpotifyLogin, logoutSpotify, spotifyIsLoggedIn } from '../../services/spotify/auth';
import { DEFAULT_PLAYLIST_ID, DEFAULT_PLAYLISTS } from '../../services/spotify/playlists';
import logger from '../../utils/logger';

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
  const { initGame } = useGameInitializer();

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
      logoutSpotify();
      setIsLoggedInSpotify(false);
    }
  };

  // If someone comes to /settings, they are the host
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
    initGame();
  }, [sessionId, initGame]);

  // Reset the flag when we successfully get a session or when component unmounts
  useEffect(() => {
    if (sessionId) {
      hasTriedToInit.current = false;
    }
  }, [sessionId]);

  const handleCopyLink = () => {
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 2000);
  };

  const handleCopyError = () => {
    setShowCopyError(true);
    setTimeout(() => setShowCopyError(false), 4000);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      {/* ...existing connection status UI... */}
      {wsStatus === 'connecting' || wsStatus === 'closed' ? (
        <div className="alert alert-warning max-w-md flex flex-col gap-2">
          <div>
            <span className="loading loading-spinner loading-sm mr-2"></span>
            <span className="font-semibold">Establishing connection...</span>
          </div>
          <p className="text-sm">
            Please wait while the connection to the server is being established.
          </p>
        </div>
      ) : wsStatus === 'failed' ? (
        <div className="alert alert-error max-w-md flex flex-col gap-3">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6 inline mr-2"
              fill="none"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Error"
            >
              <title>Error</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-semibold">Connection could not be established.</span>
          </div>
          <p className="text-sm">Please reload the page or try again later.</p>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              🔄 Reload
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              ← Back
            </button>
          </div>
        </div>
      ) : sessionId ? (
        <>
          {/* Spotify Integration */}
          <Card className="w-full max-w-md" bodyClassName="items-center gap-3">
            {isLoggedInSpotify ? (
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center gap-3 w-full justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-success">✓</span>
                    <span className="font-medium">Connected to Spotify</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-error btn-sm"
                    onClick={handleSpotifyLogout}
                  >
                    Logout
                  </button>
                </div>

                {/* Playlist Selection */}
                <div className="w-full flex flex-col gap-2">
                  <label htmlFor="playlist-select" className="label">
                    <span className="label-text font-medium">Select Playlist</span>
                  </label>
                  {playlistsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span>Loading playlists...</span>
                    </div>
                  ) : playlistsError ? (
                    <div className="alert alert-warning py-2">
                      <span className="text-sm">{playlistsError}</span>
                    </div>
                  ) : (
                    <select
                      id="playlist-select"
                      className="select select-bordered w-full"
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
                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                      <span className="loading loading-spinner loading-sm"></span>
                      <span>Validating playlist...</span>
                    </div>
                  )}
                  {playlistValidationError && !playlistValidationLoading && (
                    <div className="alert alert-warning py-2">
                      <span className="text-sm">{playlistValidationError}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`btn btn-success w-full ${spotifyLoginLoading ? 'loading' : ''}`}
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
          <div className="w-full max-w-md flex flex-col gap-3 mt-4">
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
              className={`btn btn-lg w-full ${
                isGameRunning ? 'btn-primary' : 'btn-success'
              } ${players.length < 2 || !isLoggedInSpotify ? 'btn-disabled' : ''}`}
              disabled={players.length < 2 || !isLoggedInSpotify}
            >
              {isGameRunning ? '💾 Save & Return' : '🎮 Start Game'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-outline btn-error"
            >
              Cancel & Leave
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}
