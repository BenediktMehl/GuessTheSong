import { useState, useEffect, useRef } from 'react';
import { pauseOrResumeSpotifyTrack, playSpotifyTrack, skipTrack, SpotifyResponseStatus, getPlaybackState, getUserPlaylists, getPlaylistTracks, getPlaylistById, searchPlaylists, type SpotifyPlaylist, type SpotifyTrack } from '../MusicHost/spotifyMusic'
import { Card } from '../../../components/Card'
import PlayersLobby from '../../../components/PlayersLobby'
import { useGameContext } from '../../../game/context'

const DEFAULT_PLAYLIST_ID = '1jHJldEedIdF8D49kPEiPR';

export default function HostGame() {
    const { players } = useGameContext();
    const [spotifyStatus, setSpotifyStatus] = useState<SpotifyResponseStatus>(SpotifyResponseStatus.NOT_TRIED);
    const [showToast, setShowToast] = useState(true);
    const [skippedTrack, setSkippedTrack] = useState<Boolean>(false);
    const [currentTrack, setCurrentTrack] = useState<any>(null);
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
    const [defaultPlaylist, setDefaultPlaylist] = useState<SpotifyPlaylist | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<SpotifyPlaylist[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
    const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [loadingTracks, setLoadingTracks] = useState(false);
    const [loadingDefaultPlaylist, setLoadingDefaultPlaylist] = useState(false);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const nowPlayingBodyClass = currentTrack
        ? 'flex items-center gap-4'
        : 'items-center text-center gap-2';

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
        const loadDefaultPlaylist = async () => {
            setLoadingDefaultPlaylist(true);
            const playlist = await getPlaylistById(DEFAULT_PLAYLIST_ID);
            if (playlist) {
                setDefaultPlaylist(playlist);
            }
            setLoadingDefaultPlaylist(false);
        };
        loadDefaultPlaylist();
    }, []);

    // Auto-select default playlist when it's loaded and no playlist is selected
    useEffect(() => {
        if (defaultPlaylist && !selectedPlaylistId) {
            setSelectedPlaylistId(DEFAULT_PLAYLIST_ID);
        }
    }, [defaultPlaylist, selectedPlaylistId]);

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

    useEffect(() => {
        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // If search query is empty, clear search results
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        // Debounce search
        searchTimeoutRef.current = setTimeout(async () => {
            setLoadingSearch(true);
            const response = await searchPlaylists(searchQuery.trim());
            if (response) {
                setSearchResults(response.playlists.items);
            } else {
                setSearchResults([]);
            }
            setLoadingSearch(false);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

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
                    {loadingPlaylists || loadingDefaultPlaylist ? (
                        <div className="flex items-center justify-center py-4">
                            <span className="loading loading-spinner loading-md"></span>
                        </div>
                    ) : (
                        <>
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text">Search for playlists</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Search playlists..."
                                    className="input input-bordered w-full"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {loadingSearch && (
                                    <div className="flex items-center justify-start mt-2">
                                        <span className="loading loading-spinner loading-sm"></span>
                                        <span className="text-xs text-base-content/60 ml-2">Searching...</span>
                                    </div>
                                )}
                            </div>
                            <select
                                className="select select-bordered w-full"
                                value={selectedPlaylistId}
                                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                            >
                                <option value="">Select a playlist...</option>
                                {defaultPlaylist && (
                                    <option key={defaultPlaylist.id} value={defaultPlaylist.id}>
                                        ⭐ {defaultPlaylist.name} {defaultPlaylist.tracks?.total ? `(${defaultPlaylist.tracks.total} tracks)` : ''}
                                    </option>
                                )}
                                {playlists
                                    .filter(p => p.id !== DEFAULT_PLAYLIST_ID)
                                    .map((playlist) => (
                                        <option key={playlist.id} value={playlist.id}>
                                            {playlist.name} {playlist.tracks?.total ? `(${playlist.tracks.total} tracks)` : ''}
                                        </option>
                                    ))}
                                {searchQuery.trim() && searchResults.length > 0 && (
                                    <>
                                        <optgroup label="Search Results">
                                            {searchResults
                                                .filter(p => p.id !== DEFAULT_PLAYLIST_ID && !playlists.some(up => up.id === p.id))
                                                .map((playlist) => (
                                                    <option key={playlist.id} value={playlist.id}>
                                                        {playlist.name} {playlist.tracks?.total ? `(${playlist.tracks.total} tracks)` : ''}
                                                    </option>
                                                ))}
                                        </optgroup>
                                    </>
                                )}
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