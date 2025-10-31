import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGameContext } from "../../../game/context";
import { useGameInitializer } from "../../../game/host";
import GameCode from "../../../components/GameCode";
import PlayersLobby from "../../../components/PlayersLobby";

export default function Settings() {
    const [showCopiedToast, setShowCopiedToast] = useState(false);
    const [showCopyError, setShowCopyError] = useState(false);
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
        // Don't try to init if we already have a session or if connection has failed
        if(sessionId || wsStatus === 'failed') return;
        initGame();
    }, [sessionId, initGame, wsStatus]);

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

            {wsStatus === 'failed' ? (
                <div className="alert alert-error max-w-md flex flex-col gap-3">
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6 inline mr-2" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Server nicht erreichbar. Bitte versuche es später nochmal.</span>
                    </div>
                    <button 
                        onClick={() => navigate('/')} 
                        className="btn btn-outline btn-sm"
                    >
                        ← Zurück zur Startseite
                    </button>
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

                    <div className="w-full max-w-md flex flex-col gap-3">
                        <button
                            onClick={() => {
                                if (players.length >= 2) {
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
            ) : (
                <div className="alert alert-error max-w-md">
                    <span>Failed to create game session. Please refresh.</span>
                </div>
            )}
        </main>
    );
}
