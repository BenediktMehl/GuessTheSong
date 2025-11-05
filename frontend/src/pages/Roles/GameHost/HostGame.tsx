import { useState, useEffect } from 'react';
import { pauseOrResumeSpotifyTrack, playSpotifyTrack, skipTrack, SpotifyResponseStatus, getPlaybackState, getUserPlaylists, getPlaylistTracks, type SpotifyPlaylist, type SpotifyTrack } from '../MusicHost/spotifyMusic'
import { Card } from '../../../components/Card'
import PlayersLobby from '../../../components/PlayersLobby'
import { useGameContext } from '../../../game/context'

const HIDE_SONG_UNTIL_BUZZED_KEY = 'hostHideSongUntilBuzzed';

export default function HostGame() {
    const { players, waitingPlayers } = useGameContext();
    const [spotifyStatus, setSpotifyStatus] = useState<SpotifyResponseStatus>(SpotifyResponseStatus.NOT_TRIED);
    const [showToast, setShowToast] = useState(true);
    const [skippedTrack, setSkippedTrack] = useState<Boolean>(false);
    const [currentTrack, setCurrentTrack] = useState<any>(null);
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
    const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [loadingTracks, setLoadingTracks] = useState(false);
    const [hideSongUntilBuzzed, setHideSongUntilBuzzed] = useState<boolean>(() => {
        const stored = localStorage.getItem(HIDE_SONG_UNTIL_BUZZED_KEY);
        return stored === 'true';
    });

    // Fetch current track info
    const fetchCurrentTrack = async () => {
        const playbackState = await getPlaybackState();
        if (playbackState && playbackState.item) {
            setCurrentTrack(playbackState.item);
        } else {
            setCurrentTrack(null);
        }
    };

    useEffect(() => {
        fetchCurrentTrack();
        // Optionally, poll every few seconds:
        // const interval = setInterval(fetchCurrentTrack, 5000);
        // return () => clearInterval(interval);
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
        fetchCurrentTrack();
    }

    const handleSkipTrack = async () => {
        const spotifyReponse = await skipTrack();
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setSkippedTrack(true);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        setTimeout(() => setSkippedTrack(false), 2000);
        fetchCurrentTrack();
    }

    const handlePlayTrackFromPlaylist = async (trackUri: string) => {
        setSpotifyStatus(SpotifyResponseStatus.TRYING);
        const spotifyReponse = await playSpotifyTrack(trackUri);
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        fetchCurrentTrack();
    }

    const handleToggleHideSong = (checked: boolean) => {
        setHideSongUntilBuzzed(checked);
        localStorage.setItem(HIDE_SONG_UNTIL_BUZZED_KEY, checked.toString());
    }

    // Determine if song should be visible
    const shouldShowSong = !hideSongUntilBuzzed || waitingPlayers.length > 0;
    
    // Determine body class based on track and visibility
    const nowPlayingBodyClass = currentTrack && shouldShowSong
        ? 'flex items-center gap-4'
        : 'items-center text-center gap-2';

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
            <h2 className="text-4xl font-bold text-primary mb-2">Host Game</h2>

            <div className="w-full max-w-md flex flex-col gap-6">
                <Card title="Now Playing" className="w-full" bodyClassName={nowPlayingBodyClass}>
                    {currentTrack ? (
                        shouldShowSong ? (
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

                <Card title="Playlist Selection" className="w-full" bodyClassName="flex flex-col gap-3">
                    {loadingPlaylists ? (
                        <div className="flex items-center justify-center py-4">
                            <span className="loading loading-spinner loading-md"></span>
                        </div>
                    ) : (
                        <>
                            <select
                                className="select select-bordered w-full"
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
                                                    className="btn btn-sm btn-outline w-full justify-start text-left"
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
                    <div className="flex gap-2">
                        <button
                            className="btn btn-success flex-1"
                            onClick={() => {
                                if (playlistTracks.length > 0) {
                                    const randomTrack = playlistTracks[Math.floor(Math.random() * playlistTracks.length)];
                                    handlePlayTrackFromPlaylist(randomTrack.track.uri);
                                }
                            }}
                            disabled={playlistTracks.length === 0}
                        >
                            Play Random
                        </button>
                        <button
                            className="btn btn-warning flex-1"
                            onClick={() => {
                                pauseOrResumeTrack()
                            }}
                        >
                            {spotifyStatus === SpotifyResponseStatus.PAUSED ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            className="btn btn-info flex-1"
                            onClick={() => handleSkipTrack()}
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