import React from 'react'
import { pauseOrResumeSpotifyTrack, playSpotifyTrack, skipTrack, SpotifyResponseStatus } from '../util/spotifyMusic'

export default function HostGame() {
    const [spotifyStatus, setSpotifyStatus] = React.useState<SpotifyResponseStatus>(SpotifyResponseStatus.NOT_TRIED);
    const [showToast, setShowToast] = React.useState(true);
    const [skippedTrack, setSkippedTrack] = React.useState<Boolean>(false);

    const playTrack = async () => {

        setSpotifyStatus(SpotifyResponseStatus.TRYING);
        const trackUri = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';
        const spotifyReponse = await playSpotifyTrack(trackUri);
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000)
    }

    const pauseOrResumeTrack = async () => {
        const spotifyReponse = await pauseOrResumeSpotifyTrack();
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000)
    }

    const handleSkipTrack = async () => {
        const spotifyReponse = await skipTrack();
        console.log('Spotify response:', spotifyReponse);
        setSpotifyStatus(spotifyReponse);
        setSkippedTrack(true);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000)
        setTimeout(() => setSkippedTrack(false), 2000)
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-base-200">
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