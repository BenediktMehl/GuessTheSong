import type { Player } from '../game/context';
import { Card } from './Card';

interface PlayersLobbyProps {
  players: Player[];
  minPlayers?: number;
  currentPlayerId?: string;
}

export default function PlayersLobby({
  players,
  minPlayers = 2,
  currentPlayerId,
}: PlayersLobbyProps) {
  return (
    <Card
      className="w-full max-w-md max-h-[60vh] flex flex-col"
      bodyClassName="flex flex-col flex-1 gap-3 overflow-hidden"
    >
      {players.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-3">
          <div className="text-3xl mb-2">👥</div>
          <p className="text-xs text-base-content/60">Waiting for players...</p>
        </div>
      ) : (
        <ul className="space-y-1.5 overflow-y-auto flex-1 min-h-0 pr-1">
          {players.map((player, index) => {
            const isCurrentPlayer = currentPlayerId && player.id === currentPlayerId;
            return (
              <li
                key={player.id}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                  isCurrentPlayer
                    ? 'bg-success/25 border-2 border-success/60 shadow-lg'
                    : 'bg-white/60 hover:bg-white/80 shadow-md'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">#{index + 1}</span>
                  <span className="font-medium text-sm">
                    {player.name}
                    {isCurrentPlayer && (
                      <span className="ml-2 text-success text-xs font-bold">(You)</span>
                    )}
                  </span>
                </div>
                <span className="badge badge-primary badge-sm bg-opacity-90">{player.points}</span>
              </li>
            );
          })}
        </ul>
      )}

      {players.length < minPlayers && (
        <div className="alert alert-warning bg-opacity-80 py-2 shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Warning"
          >
            <title>Warning</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-sm">Need {minPlayers}+ players</span>
        </div>
      )}
    </Card>
  );
}
