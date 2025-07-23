import { useState, useEffect } from "react";
import { useGameContext } from "../../../game/context";
import { sendMusicHostChangedAction, useGameInitializer } from "../../../game/host";

export default function Settings() {
    const [showCopiedToast, setShowCopiedToast] = useState(false);
    const { 
        players, 
        referee, 
        musicHost, 
        sessionId, 
        status, 
        iAm, 
        setIAm, 
        addPlayer, 
        setMusicHost, 
        setReferee
    } = useGameContext();
    const [inviteLink, setInviteLink] = useState("");
    const [myName, setMyName] = useState<string>("");
    const [hostNameSaved, setHostNameSaved] = useState(false);
    const [isRotatingReferee, setIsRotatingReferee] = useState(true);
    // Add local state to track selections
    const [localMusicHostId, setLocalMusicHostId] = useState<string>(musicHost?.id || "");
    const [localRefereeId, setLocalRefereeId] = useState<string>(referee?.id || "");
    const isGameRunning = status !== 'notStarted' && status !== 'finished';
    const { initGame } = useGameInitializer();

    // Sync local state with context when context changes
    useEffect(() => {
        if (musicHost?.id) {
            setLocalMusicHostId(musicHost.id);

        }
    }, [musicHost]);

    useEffect(() => {
        if (referee?.id) {
            setLocalRefereeId(referee.id);
        }
    }, [referee]);

    useEffect(() => {
        const inviteLink = sessionId ? `${window.location.origin}/join?id=${sessionId}` : "";
        setInviteLink(inviteLink);
    }, [sessionId]);

    useEffect(() => {
        if(sessionId) return;
        initGame();
    }, [sessionId, initGame]);

    // Handle music host selection
    const handleMusicHostChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        console.log("Selected music host ID:", selectedId);
        // Update local state immediately for responsive UI
        setLocalMusicHostId(selectedId);
        
        const selected = players.find(player => player.id === selectedId);
        if (selected) {
            console.log("Setting music host to:", selected.name);
            // Force a new object to ensure context updates
            setMusicHost({...selected});
            sendMusicHostChangedAction(selectedId);
        }
    };

    // Handle referee selection
    const handleRefereeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        console.log("Selected referee ID:", selectedId);
        // Update local state immediately for responsive UI
        setLocalRefereeId(selectedId);
        
        const selected = players.find(player => player.id === selectedId);
        if (selected) {
            console.log("Setting referee to:", selected.name);
            // Force a new object to ensure context updates
            setReferee({...selected});
        }
    };

    // Handle referee mode toggle
    const handleRefereeToggle = () => {
        setIsRotatingReferee(!isRotatingReferee);
        if (!isRotatingReferee && players.length > 0) {
            // If switching to random/rotating, set a random referee
            const randomIndex = Math.floor(Math.random() * players.length);
            setReferee(players[randomIndex]);
        }
    };

    function handleUserNameSubmit(): void {
        if (myName.trim() === "") {
            alert("Name cannot be empty.");
            return;
        }
        const newPlayer = {
            id: crypto.randomUUID(),
            name: myName.trim(),
            points: 0,
        };
        setIAm(newPlayer);
        addPlayer(newPlayer);
        setHostNameSaved(true);
        setTimeout(() => setHostNameSaved(false), 2000);
    }

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
                {!iAm && (<div className="mb-4 flex items-center gap-2 w-full max-w-md justify-center">
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        value={myName}
                        onChange={e => setMyName(e.target.value)}
                        maxLength={16}
                        placeholder="Enter your name"
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleUserNameSubmit}
                    >
                        Save
                    </button>
                </div>)}
                {hostNameSaved && (
                    <div className="toast toast-top toast-center">
                        <div className="alert alert-success">
                            <span>Host name saved!</span>
                        </div>
                    </div>
                )}

                {/* Music Host Selection */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Music Host (Spotify)</label>
                    <select 
                        className="select select-bordered w-full" 
                        value={localMusicHostId}
                        onChange={handleMusicHostChange}
                        disabled={players.length === 0}
                    >
                        <option value="" disabled>Select a player</option>
                        {players.map(player => (
                            <option key={player.id} value={player.id}>
                                {player.name}
                            </option>
                        ))}
                    </select>
                </div>
                
                {/* Referee Selection */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Referee</label>
                        <div className="flex items-center">
                            <span className="mr-2 text-sm">Rotate</span>
                            <input 
                                type="checkbox" 
                                className="toggle toggle-primary" 
                                checked={!isRotatingReferee}
                                onChange={handleRefereeToggle}
                            />
                            <span className="ml-2 text-sm">Fixed</span>
                        </div>
                    </div>
                    
                    {!isRotatingReferee && (
                        <select 
                            className="select select-bordered w-full" 
                            value={localRefereeId}
                            onChange={handleRefereeChange}
                            disabled={players.length === 0}
                        >
                            <option value="" disabled>Select a referee</option>
                            {players.map(player => (
                                <option key={player.id} value={player.id}>
                                    {player.name}
                                </option>
                            ))}
                        </select>
                    )}
                    
                    {isRotatingReferee && (
                        <p className="text-sm text-gray-500">
                            A random player will be selected as referee for the next round. Then the role will rotate.
                        </p>
                    )}
                </div>

                <h3 className="text-lg font-semibold mb-2">Current Players:</h3>
                <ul className="list-disc list-inside">
                    {players.length === 0 ? (
                        <li className="text-gray-500">No players joined yet.</li>
                    ) : (
                        players.map(player => (
                            <li key={player.id} className="mb-1 flex items-center">
                                <span>{player.name}</span>
                                <span className="ml-2 text-sm text-gray-500">({player.points} pts)</span>
                            </li>
                        ))
                    )}
                </ul>
            </div>
            <a
                href={players.length >= 3 ? "/hostgame" : "#"}
                className={`btn ${isGameRunning ? 'btn-primary' : 'btn-success'} mt-4 ${players.length < 3 ? 'btn-disabled' : ''}`}
                onClick={(e) => {
                    if (players.length < 3) {
                        e.preventDefault();
                    }
                }}
            >
                {isGameRunning ? 'Save' : 'Start Game'}
            </a>
            {players.length < 3 && !isGameRunning && (
                <p className="text-sm text-error mt-2 text-center">
                    You need at least 3 players to start the game.
                </p>
            )}
        </main >
    )
}