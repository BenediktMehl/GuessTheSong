import { useEffect } from "react";
import { useGameContext } from "../game/context";
import { useNavigate } from "react-router-dom";
import GameCode from "../components/GameCode";
import PlayersLobby from "../components/PlayersLobby";

export default function PlayerLobby() {
    const { sessionId, players, status } = useGameContext();
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
        <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
            <h1 className="text-4xl font-bold text-primary mb-2">Lobby</h1>
            
            {sessionId && <GameCode sessionId={sessionId} showCopyLink={false} />}
            
            <PlayersLobby players={players} minPlayers={2} />

            <div className="card bg-base-300 shadow-lg p-6 w-full max-w-md text-center">
                <div className="text-5xl mb-4 animate-bounce">⏳</div>
                <p className="text-lg font-semibold mb-2">Waiting for host to start the game...</p>
                <p className="text-sm text-gray-500">
                    Share the game code with your friends!
                </p>
            </div>

            <button 
                onClick={() => navigate('/join')}
                className="btn btn-outline btn-error"
            >
                Leave Lobby
            </button>
        </main>
    );
}
