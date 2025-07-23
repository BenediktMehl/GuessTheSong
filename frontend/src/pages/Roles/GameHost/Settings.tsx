import { useState, useEffect } from "react";
import { useGameContext } from "../../../game/context";
import { useGameInitializer } from "../../../game/host";

export default function Settings() {
    const [showCopiedToast, setShowCopiedToast] = useState(false);
    const { players, referee, musicHost, sessionId, setSessionId, status } = useGameContext();
    const [inviteLink, setInviteLink] = useState("");
    const isGameRunning = status !== 'notStarted' && status !== 'finished';
    const { initGame } = useGameInitializer();


    useEffect(() => {
        const inviteLink = sessionId ? `${window.location.origin}/join?id=${sessionId}` : "";
        setInviteLink(inviteLink);
    }, [sessionId]);

    useEffect(() => {
        initGame()
    }, []);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center">
            <h2 className="text-2xl mb-2 text-center">Settings</h2>
            {inviteLink ? (
                <>
                    <p className="mb-4 text-base-content text-center">
                        This is your game code: {sessionId}
                    </p>
                    <p className="mb-2 text-center">Share this invite link with your friends:</p>
                    <div className="mb-4 flex items-center gap-2 w-full max-w-md justify-center">
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            value={inviteLink}
                            readOnly
                            onFocus={e => e.target.select()}
                        />
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                navigator.clipboard.writeText(inviteLink)
                                setShowCopiedToast(true)
                                setTimeout(() => setShowCopiedToast(false), 2000)
                            }}
                        >
                            Copy
                        </button>
                    </div>
                    {showCopiedToast && (
                        <div className="toast toast-top toast-center">
                            <div className="alert alert-success">
                                <span>Invite link copied to clipboard!</span>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="mb-4 text-gray-500">Something went wrong. Please try again later.</div>
            )}
            <div className="w-full max-w-md mt-4">
                <h3 className="text-lg font-semibold mb-2">Current Players:</h3>
                <ul className="list-disc list-inside">
                    {players.length === 0 ? (
                        <li className="text-gray-500">No players joined yet.</li>
                    ) : (
                        players.map(player => (
                            <li key={player.id} className="mb-1 flex items-center">
                                <span>{player.name}</span>
                                <span className="ml-2 text-sm text-gray-500">({player.points} pts)</span>
                                {musicHost?.id === player.id && (
                                    <img
                                        src="/spotify_logo.png"
                                        alt="Music Host"
                                        className="ml-2 h-4 w-4"
                                        title="Music Host"
                                    />
                                )}
                                {referee?.id === player.id && (
                                    <div
                                        className="ml-2 h-4 w-3 bg-yellow-400 border border-yellow-600"
                                        title="Referee"
                                    ></div>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            </div>
            <a
                href="/hostgame"
                className={`btn ${isGameRunning ? 'btn-primary' : 'btn-success'} mt-4`}
            >
                {isGameRunning ? 'Save' : 'Start Game'}
            </a>
        </main >
    )
}