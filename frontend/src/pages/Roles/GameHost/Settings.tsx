import { useState, useEffect, useRef } from "react";
import { handleSpotifyLogin } from "../MusicHost/spotifyAuth";
import { useSpotifyAuth } from "../MusicHost/SpotifyAuthContext";
import { Card } from "../../../components/Card";
import { useNavigate } from "react-router-dom";
import { useGameContext } from "../../../game/context";
import { useGameInitializer, startGame } from "../../../game/host";
import GameCode from "../../../components/GameCode";
import PlayersLobby from "../../../components/PlayersLobby";

export default function Settings() {
    const [showCopiedToast, setShowCopiedToast] = useState(false);
    const [showCopyError, setShowCopyError] = useState(false);
    const [spotifyLoginLoading, setSpotifyLoginLoading] = useState(false);
    const { profile, isLoggedIn, refreshProfile, logout } = useSpotifyAuth();
    // On mount, check Spotify login status
    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);
    const handleSpotifyLoginClick = async () => {
        setSpotifyLoginLoading(true);
        try {
            await handleSpotifyLogin();
            await refreshProfile();
        } finally {
            setSpotifyLoginLoading(false);
        }
    };
    const hasTriedToInit = useRef(false); // Track if we've already tried to initialize
    const navigate = useNavigate();
    const gameContext = useGameContext();
    const { 
        players, 
        sessionId, 
        status,
        isHost,
        setIsHost,
        wsStatus
    } = gameContext;
    const isGameRunning = status !== 'notStarted' && status !== 'finished';
    const { initGame } = useGameInitializer();

    // Wenn jemand auf /settings kommt, ist er der Host
    useEffect(() => {
        if (!isHost) {
            setIsHost(true);
        }
    }, [isHost, setIsHost]);

    useEffect(() => {
        // Don't try to init if we already have a session
        if(sessionId) return;
        
        // Only init once - let the initGame function handle retries internally
        if(hasTriedToInit.current) return;
        
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
            <h2 className="text-4xl font-bold text-primary mb-2">Host Settings</h2>

            {/* ...existing connection status UI... */}
            {wsStatus === 'connecting' || wsStatus === 'closed' ? (
                <div className="alert alert-warning max-w-md flex flex-col gap-2">
                    <div>
                        <span className="loading loading-spinner loading-sm mr-2"></span>
                        <span className="font-semibold">Stelle Verbindung her...</span>
                    </div>
                    <p className="text-sm">Bitte warten, während die Verbindung zum Server aufgebaut wird.</p>
                </div>
            ) : wsStatus === 'failed' ? (
                <div className="alert alert-error max-w-md flex flex-col gap-3">
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6 inline mr-2" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">Verbindung konnte nicht aufgebaut werden.</span>
                    </div>
                    <p className="text-sm">Bitte lade die Seite neu oder versuche es später nochmal.</p>
                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <button 
                            onClick={() => window.location.reload()} 
                            className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
                        >
                            🔄 Neu laden
                        </button>
                        <button 
                            onClick={() => navigate('/')} 
                            className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
                        >
                            ← Zurück
                        </button>
                    </div>
                </div>
            ) : sessionId ? (
                <>
                    <GameCode 
                        sessionId={sessionId} 
                        showCopyLink={true} 
                        onCopy={handleCopyLink}
                        onCopyError={handleCopyError}
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

                    <PlayersLobby players={players} minPlayers={2} />

                    {/* Spotify login section */}
                    <div className="w-full max-w-md flex flex-col gap-3 mt-4">
                        <Card
                            title="Spotify Integration"
                            className="w-full"
                            bodyClassName="items-center gap-3"
                        >
                            {isLoggedIn && profile ? (
                                <div className="flex items-center gap-3">
                                    <img src={profile.images?.[0]?.url} alt="Spotify profile" className="w-10 h-10 rounded-full border border-white/40" />
                                    <span className="font-medium">{profile.display_name}</span>
                                    <button className="btn btn-outline btn-error btn-sm" onClick={logout}>
                                        Logout
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className={`btn btn-success w-full ${spotifyLoginLoading ? 'loading' : ''}`}
                                    onClick={handleSpotifyLoginClick}
                                    disabled={spotifyLoginLoading}
                                >
                                    {spotifyLoginLoading ? 'Logging in...' : 'Log in to Spotify'}
                                </button>
                            )}
                        </Card>

                        {/* ...existing game control buttons... */}
                        <button
                            onClick={() => {
                                if (players.length >= 2) {
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
                            } ${players.length < 2 ? 'btn-disabled' : ''}`}
                            disabled={players.length < 2}
                        >
                            {isGameRunning ? '💾 Save & Return' : '🎮 Start Game'}
                        </button>

                        <button 
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
