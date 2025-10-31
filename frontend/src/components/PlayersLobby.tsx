import type { Player } from "../game/context";

interface PlayersLobbyProps {
    players: Player[];
    minPlayers?: number;
}

export default function PlayersLobby({ players, minPlayers = 2 }: PlayersLobbyProps) {
    return (
        <div className="card bg-base-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4 text-center">
                Players ({players.length}/{minPlayers}+)
            </h3>
            
            {players.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-6xl mb-4">👥</div>
                    <p className="text-gray-500">Waiting for players to join...</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {players.map((player, index) => (
                        <li 
                            key={player.id} 
                            className="flex items-center justify-between p-3 bg-base-300 rounded-lg hover:bg-base-100 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-semibold text-primary">
                                    #{index + 1}
                                </span>
                                <span className="font-medium text-lg">{player.name}</span>
                            </div>
                            <span className="badge badge-primary badge-lg">
                                {player.points} pts
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {players.length < minPlayers && (
                <div className="alert alert-warning mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Need at least {minPlayers} players to start</span>
                </div>
            )}
        </div>
    );
}
