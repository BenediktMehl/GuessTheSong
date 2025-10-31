import { useState, useEffect } from "react";
import { useGameContext } from "../../../game/context";
import { useGameInitializer } from "../../../game/host";

export default function Settings() {
    const [showCopiedToast, setShowCopiedToast] = useState(false);
    const gameContext = useGameContext();
    const { 
        players, 
        sessionId, 
        status,
        isHost,
        setIsHost
    } = gameContext;
    const [inviteLink, setInviteLink] = useState("");
    const isGameRunning = status !== 'notStarted' && status !== 'finished';
    const { initGame } = useGameInitializer();

    // Wenn jemand auf /settings kommt, ist er der Host
    useEffect(() => {
        if (!isHost) {
            setIsHost(true);
        }
    }, [isHost, setIsHost]);

    useEffect(() => {
        const inviteLink = sessionId ? `${window.location.origin}/join?id=${sessionId}` : "";
        setInviteLink(inviteLink);
    }, [sessionId]);

    useEffect(() => {
        if(sessionId) return;
        initGame();
    }, [sessionId, initGame]);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-4">
            <h2 className="text-3xl font-bold mb-6">Game Settings</h2>

            {inviteLink ? (
                <>
                    <div className="card bg-base-200 shadow-xl p-6 w-full max-w-md mb-6">
                        <h3 className="text-xl font-semibold mb-4">Game Code</h3>
                        <div className="text-center">
                            <span className="text-4xl font-mono font-bold tracking-widest">{sessionId}</span>
                        </div>
                    </div>

                    <div className="card bg-base-200 shadow-xl p-6 w-full max-w-md mb-6">
                        <h3 className="text-xl font-semibold mb-4">Invite Link</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="input input-bordered flex-1"
                                value={inviteLink}
                                readOnly
                                onFocus={e => e.target.select()}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    navigator.clipboard.writeText(inviteLink);
                                    setShowCopiedToast(true);
                                    setTimeout(() => setShowCopiedToast(false), 2000);
                                }}
                            >
                                📋 Copy
                            </button>
                        </div>
                    </div>

                    {showCopiedToast && (
                        <div className="toast toast-top toast-center">
                            <div className="alert alert-success">
                                <span>✓ Link copied!</span>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="alert alert-error">
                    <span>Failed to create game session. Please refresh.</span>
                </div>
            )}

            <div className="card bg-base-200 shadow-xl p-6 w-full max-w-md mb-6">
                <h3 className="text-xl font-semibold mb-4">Players ({players.length})</h3>
                {players.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Waiting for players to join...</p>
                ) : (
                    <ul className="space-y-2">
                        {players.map((player, index) => (
                            <li key={player.id} className="flex items-center justify-between p-3 bg-base-300 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-semibold text-primary">#{index + 1}</span>
                                    <span className="font-medium">{player.name}</span>
                                </div>
                                <span className="badge badge-primary">{player.points} pts</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="w-full max-w-md">
                <a
                    href={players.length >= 2 ? "/hostgame" : "#"}
                    className={`btn btn-lg w-full ${
                        isGameRunning ? 'btn-primary' : 'btn-success'
                    } ${players.length < 2 ? 'btn-disabled' : ''}`}
                    onClick={(e) => {
                        if (players.length < 2) {
                            e.preventDefault();
                        }
                    }}
                >
                    {isGameRunning ? '💾 Save & Return' : '🎮 Start Game'}
                </a>
                {players.length < 2 && !isGameRunning && (
                    <p className="text-sm text-error mt-3 text-center">
                        ⚠️ You need at least 2 players to start the game.
                    </p>
                )}
            </div>
        </main>
    );
}
