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
        setIsHost
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
        if(sessionId) return;
        initGame();
    }, [sessionId, initGame]);

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

            {sessionId ? (
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
