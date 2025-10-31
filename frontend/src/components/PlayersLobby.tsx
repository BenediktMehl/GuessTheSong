import type { Player } from "../game/context";

interface PlayersLobbyProps {
    players: Player[];
    minPlayers?: number;
    currentPlayerId?: string;
}

export default function PlayersLobby({ players, minPlayers = 2, currentPlayerId }: PlayersLobbyProps) {
    return (
        <div className="card bg-base-200 bg-opacity-70 shadow-2xl p-3 w-full max-w-md max-h-[60vh] overflow-hidden flex flex-col">
            <h3 className="text-base font-semibold mb-2 text-center">
                Players ({players.length}/{minPlayers}+)
            </h3>
            
            {players.length === 0 ? (
                <div className="text-center py-3">
                    <div className="text-3xl mb-2">👥</div>
                    <p className="text-xs text-gray-500">Waiting for players...</p>
                </div>
            ) : (
                <ul className="space-y-1.5 overflow-y-auto flex-shrink min-h-0">
                    {players.map((player, index) => {
                        const isCurrentPlayer = currentPlayerId && player.id === currentPlayerId;
                        return (
                            <li 
                                key={player.id} 
                                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                    isCurrentPlayer 
                                        ? 'bg-success bg-opacity-30 border-2 border-success shadow-lg' 
                                        : 'bg-base-300 bg-opacity-70 hover:bg-base-100 hover:bg-opacity-80 shadow-md'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-primary">
                                        #{index + 1}
                                    </span>
                                    <span className="font-medium text-sm">
                                        {player.name}
                                        {isCurrentPlayer && (
                                            <span className="ml-2 text-success text-xs font-bold">
                                                (You)
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <span className="badge badge-primary badge-sm bg-opacity-80">
                                    {player.points}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {players.length < minPlayers && (
                <div className="alert alert-warning bg-opacity-70 py-2 mt-2 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm">Need {minPlayers}+ players</span>
                </div>
            )}
        </div>
    );
}
