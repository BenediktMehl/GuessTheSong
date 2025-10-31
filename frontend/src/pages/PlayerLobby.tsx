import { useEffect } from "react";
import { useGameContext } from "../game/context";
import { useNavigate } from "react-router-dom";
import GameCode from "../components/GameCode";
import PlayersLobby from "../components/PlayersLobby";

export default function PlayerLobby() {
    const { sessionId, players, status, currentPlayerId } = useGameContext();
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
        <main className="h-screen flex flex-col items-center justify-between p-4 py-safe overflow-hidden">
            <h1 className="text-3xl md:text-4xl font-bold text-primary">Lobby</h1>
            
            {sessionId && <GameCode sessionId={sessionId} showCopyLink={false} />}
            
            <PlayersLobby players={players} minPlayers={2} currentPlayerId={currentPlayerId} />

            <div className="card bg-base-300 shadow-lg p-4 w-full max-w-md text-center">
                <div className="text-4xl mb-2 animate-bounce">⏳</div>
                <p className="text-base font-semibold mb-1">Waiting for host...</p>
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
        </main>
    );
}
