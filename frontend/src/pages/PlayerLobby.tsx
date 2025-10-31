import { useEffect } from "react";
import { useGameContext } from "../game/context";
import { useNavigate } from "react-router-dom";
import GameCode from "../components/GameCode";
import PlayersLobby from "../components/PlayersLobby";

export default function PlayerLobby() {
    const { sessionId, players, status, currentPlayerId, wsStatus } = useGameContext();
    const navigate = useNavigate();

    // Wenn das Spiel startet, zur Play-Ansicht wechseln
    useEffect(() => {
        if (status === 'waiting' || status === 'listening' || status === 'guessing') {
            navigate('/play');
        }
    }, [status, navigate]);

    // Wenn keine Session, zurück zum Join
    useEffect(() => {
        if (!sessionId) {
            navigate('/join');
        }
    }, [sessionId, navigate]);

    return (
        <main className="h-screen flex flex-col items-center justify-center p-4 gap-4 overflow-hidden">
            <h1 className="text-2xl md:text-4xl font-bold text-primary">Lobby</h1>
            
            {wsStatus === 'failed' ? (
                <div className="alert alert-error max-w-md flex flex-col gap-3">
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6 inline mr-2" fill="none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Verbindung verloren. Bitte versuche es später nochmal.</span>
                    </div>
                    <button 
                        onClick={() => navigate('/join')} 
                        className="btn btn-outline btn-sm"
                    >
                        ← Zurück zum Join
                    </button>
                </div>
            ) : (
                <>
                    {sessionId && <GameCode sessionId={sessionId} showCopyLink={false} />}
                    
                    <PlayersLobby players={players} minPlayers={2} currentPlayerId={currentPlayerId} />

                    <div className="card bg-base-300 bg-opacity-70 shadow-2xl p-3 w-full max-w-md text-center">
                        <div className="text-3xl mb-2 animate-bounce">⏳</div>
                        <p className="text-sm font-semibold mb-1">Waiting for host...</p>
                        <p className="text-xs text-gray-500">
                            Share the game code!
                        </p>
                    </div>

                    <button 
                        onClick={() => navigate('/join')}
                        className="btn btn-sm btn-outline btn-error"
                    >
                        Leave Lobby
                    </button>
                </>
            )}
        </main>
    );
}
