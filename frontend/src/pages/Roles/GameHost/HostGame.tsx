import { useState, useEffect } from 'react';
import { pauseOrResumeSpotifyTrack, playSpotifyTrack, skipTrack, SpotifyResponseStatus, getPlaybackState } from '../MusicHost/spotifyMusic'
import { Card } from '../../../components/Card'

export default function HostGame() {
    const [spotifyStatus, setSpotifyStatus] = useState<SpotifyResponseStatus>(SpotifyResponseStatus.NOT_TRIED);
    const [showToast, setShowToast] = useState(true);
    const [skippedTrack, setSkippedTrack] = useState<Boolean>(false);
    const [currentTrack, setCurrentTrack] = useState<any>(null);
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

    const playTrack = async () => {

        setSpotifyStatus(SpotifyResponseStatus.TRYING);
        const trackUri = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';
        const spotifyReponse = await playSpotifyTrack(trackUri);
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        fetchCurrentTrack();
    }

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

    return (
        <main className="min-h-screen flex items-center justify-center bg-base-200">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
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
            <div className="flex gap-4">
                <button
                    className="btn btn-success"
                    onClick={() => playTrack()}
                >
                    Play
                </button>
                <button
                    className="btn btn-warning"
                    onClick={() => {
                        pauseOrResumeTrack()
                    }}
                >
                    {spotifyStatus === SpotifyResponseStatus.PAUSED ? 'Resume' : 'Pause'}
                </button>
                <button
                    className="btn btn-info"
                    onClick={() => handleSkipTrack()}
                >
                    Skip
                </button>
            </div>
        </main >
    )
}