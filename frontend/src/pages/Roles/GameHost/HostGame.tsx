import { useState, useEffect } from 'react';
import { pauseOrResumeSpotifyTrack, playSpotifyTrack, skipTrack, SpotifyResponseStatus, getPlaybackState, getUserPlaylists, getPlaylistTracks, type SpotifyPlaylist, type SpotifyTrack } from '../MusicHost/spotifyMusic'
import { initializePlayer, subscribeToStateChanges, subscribeToReadyState } from '../MusicHost/spotifyPlayer'
import { spotifyIsLoggedIn } from '../MusicHost/spotifyAuth'
import { Card } from '../../../components/Card'
import PlayersLobby from '../../../components/PlayersLobby'
import { useGameContext } from '../../../game/context'

export default function HostGame() {
    const { players } = useGameContext();
    const [spotifyStatus, setSpotifyStatus] = useState<SpotifyResponseStatus>(SpotifyResponseStatus.NOT_TRIED);
    const [showToast, setShowToast] = useState(true);
    const [skippedTrack, setSkippedTrack] = useState<Boolean>(false);
    const [currentTrack, setCurrentTrack] = useState<any>(null);
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
    const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [loadingTracks, setLoadingTracks] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);
    const nowPlayingBodyClass = currentTrack
        ? 'flex items-center gap-4'
        : 'items-center text-center gap-2';

    // Initialize player and set up event listeners
    useEffect(() => {
        let unsubscribeState: (() => void) | null = null;
        let unsubscribeReady: (() => void) | null = null;

        const setupPlayer = async () => {
            const isLoggedIn = await spotifyIsLoggedIn();
            if (!isLoggedIn) {
                return;
            }

            const initialized = await initializePlayer();
            if (initialized) {
                // Subscribe to ready state changes
                unsubscribeReady = subscribeToReadyState((ready) => {
                    setPlayerReady(ready);
                });
                
                // Subscribe to state changes
                unsubscribeState = subscribeToStateChanges((state) => {
                    if (state && state.track_window.current_track) {
                        const track = state.track_window.current_track;
                        setCurrentTrack({
                            id: track.id,
                            name: track.name,
                            uri: track.uri,
                            artists: track.artists.map((artist) => ({ name: artist.name })),
                            album: {
                                name: track.album.name,
                                images: track.album.images,
                            },
                            duration_ms: track.duration_ms,
                        });
                        setSpotifyStatus(state.paused ? SpotifyResponseStatus.PAUSED : SpotifyResponseStatus.PLAYING);
                    } else {
                        setCurrentTrack(null);
                    }
                });

                // Fetch initial state
                const initialState = await getPlaybackState();
                if (initialState && initialState.item) {
                    setCurrentTrack(initialState.item);
                    setSpotifyStatus(initialState.is_playing ? SpotifyResponseStatus.PLAYING : SpotifyResponseStatus.PAUSED);
                }
            } else {
                setPlayerReady(false);
            }
        };

        setupPlayer();

        return () => {
            if (unsubscribeState) {
                unsubscribeState();
            }
            if (unsubscribeReady) {
                unsubscribeReady();
            }
        };
    }, []);

    useEffect(() => {
        const loadPlaylists = async () => {
            setLoadingPlaylists(true);
            const response = await getUserPlaylists();
            if (response) {
                setPlaylists(response.items);
            }
            setLoadingPlaylists(false);
        };
        loadPlaylists();
    }, []);

    useEffect(() => {
        const loadPlaylistTracks = async () => {
            if (!selectedPlaylistId) {
                setPlaylistTracks([]);
                return;
            }
            setLoadingTracks(true);
            const response = await getPlaylistTracks(selectedPlaylistId);
            if (response) {
                setPlaylistTracks(response.items.filter(item => item.track !== null));
            }
            setLoadingTracks(false);
        };
        loadPlaylistTracks();
    }, [selectedPlaylistId]);

    const pauseOrResumeTrack = async () => {
        const spotifyReponse = await pauseOrResumeSpotifyTrack();
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    }

    const handleSkipTrack = async () => {
        const spotifyReponse = await skipTrack();
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setSkippedTrack(true);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        setTimeout(() => setSkippedTrack(false), 2000);
    }

    const handlePlayTrackFromPlaylist = async (trackUri: string) => {
        setSpotifyStatus(SpotifyResponseStatus.TRYING);
        const spotifyReponse = await playSpotifyTrack(trackUri);
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
            <h2 className="text-4xl font-bold text-primary mb-2">Host Game</h2>

            <div className="w-full max-w-md flex flex-col gap-6">
                <Card title="Now Playing" className="w-full" bodyClassName={nowPlayingBodyClass}>
                    {currentTrack ? (
                        <>
                            <img
                                src={currentTrack.album?.images?.[0]?.url}
                                alt={currentTrack.name}
                                className="w-16 h-16 rounded-xl shadow-lg"
                            />
                            <div className="text-left">
                                <div className="font-bold text-lg">{currentTrack.name}</div>
                                <div className="text-sm text-base-content/70">
                                    {currentTrack.artists?.map((a: any) => a.name).join(', ')}
                                </div>
                                <div className="text-xs text-base-content/60">{currentTrack.album?.name}</div>
                            </div>
                        </>
                    ) : (
                        <div className="w-full text-sm text-base-content/60">No track playing</div>
                    )}
                </Card>

                <Card title="Playlist Selection" className="w-full" bodyClassName="flex flex-col gap-3">
                    {loadingPlaylists ? (
                        <div className="flex items-center justify-center py-4">
                            <span className="loading loading-spinner loading-md"></span>
                        </div>
                    ) : (
                        <>
                            <select
                                className="select select-bordered w-full bg-white"
                                value={selectedPlaylistId}
                                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                            >
                                <option value="">Select a playlist...</option>
                                {playlists.map((playlist) => (
                                    <option key={playlist.id} value={playlist.id}>
                                        {playlist.name} {playlist.tracks?.total ? `(${playlist.tracks.total} tracks)` : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedPlaylistId && (
                                <div className="mt-2">
                                    {loadingTracks ? (
                                        <div className="flex items-center justify-center py-2">
                                            <span className="loading loading-spinner loading-sm"></span>
                                        </div>
                                    ) : (
                                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                                            {playlistTracks.slice(0, 20).map((item, index) => (
                                                <button
                                                    key={item.track.id || index}
                                                    className="btn btn-sm btn-outline w-full justify-start text-left bg-white"
                                                    onClick={() => handlePlayTrackFromPlaylist(item.track.uri)}
                                                >
                                                    <span className="truncate">{item.track.name} - {item.track.artists.map(a => a.name).join(', ')}</span>
                                                </button>
                                            ))}
                                            {playlistTracks.length > 20 && (
                                                <div className="text-xs text-base-content/60 text-center py-2">
                                                    Showing first 20 tracks...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </Card>

                <Card title="Controls" className="w-full" bodyClassName="flex flex-col gap-2">
                    {!playerReady && (
                        <div className="alert alert-info mb-2">
                            <span>Initializing Spotify player...</span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            className="btn btn-success flex-1"
                            onClick={() => {
                                if (playlistTracks.length > 0) {
                                    const randomTrack = playlistTracks[Math.floor(Math.random() * playlistTracks.length)];
                                    handlePlayTrackFromPlaylist(randomTrack.track.uri);
                                }
                            }}
                            disabled={playlistTracks.length === 0 || !playerReady}
                        >
                            Play Random
                        </button>
                        <button
                            className="btn btn-warning flex-1"
                            onClick={() => {
                                pauseOrResumeTrack()
                            }}
                            disabled={!playerReady}
                        >
                            {spotifyStatus === SpotifyResponseStatus.PAUSED ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            className="btn btn-info flex-1"
                            onClick={() => handleSkipTrack()}
                            disabled={!playerReady}
                        >
                            Skip
                        </button>
                    </div>
                </Card>

                <PlayersLobby players={players} />
            </div>
            {spotifyStatus === SpotifyResponseStatus.NO_ACTIVE_DEVICE && (
                <div className="toast toast-top toast-center">
                    <div className="alert alert-warning">
                        <span>No active Spotify device found. Please open Spotify on a device and try again.</span>
                    </div>
                </div>
            )}
            {spotifyStatus === SpotifyResponseStatus.ERROR && (
                <div className="toast toast-top toast-center">
                    <div className="alert alert-error">
                        <span>Error playing track. Please check your Spotify connection.</span>
                    </div>
                </div>
            )}
            {showToast && spotifyStatus === SpotifyResponseStatus.PLAYING && !skippedTrack && (
                <div className="toast toast-top toast-center">
                    <div className="alert alert-success">
                        <span>Track is now playing!</span>
                    </div>
                </div>
            )}
            {showToast && spotifyStatus === SpotifyResponseStatus.PAUSED && !skippedTrack && (
                <div className="toast toast-top toast-center">
                    <div className="alert alert-info">
                        <span>Track is paused.</span>
                    </div>
                </div>
            )}
            {showToast && skippedTrack && (
                <div className="toast toast-top toast-center">
                    <div className="alert alert-success">
                        <span>Track skipped!</span>
                    </div>
                </div>
            )}
        </main>
    )
}