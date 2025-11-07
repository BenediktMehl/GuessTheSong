import type { Player } from '../game/context';
import { Card } from './Card';

interface PlayersLobbyProps {
  notGuessedPlayers: Player[];
  waitingPlayers?: Player[];
  guessedPlayers?: Player[];
  currentPlayer?: Player;
  minPlayers?: number;
}

function PlayerItem({
  player,
  isCurrentPlayer,
  showTrophy,
}: {
  player: Player;
  isCurrentPlayer: boolean;
  showTrophy: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
        isCurrentPlayer
          ? 'bg-success/25 border-2 border-success/60 shadow-lg'
          : 'bg-white/60 hover:bg-white/80 shadow-md'
      }`}
    >
      <div className="flex items-center gap-2">
        {showTrophy && (
          <span className="text-lg" role="img" aria-label="Trophy">
            🏆
          </span>
        )}
        <span className="font-medium text-sm">
          {player.name}
          {isCurrentPlayer && <span className="ml-2 text-success text-xs font-bold">(You)</span>}
        </span>
      </div>
      <span className="badge badge-primary badge-sm bg-opacity-90">{player.points}</span>
    </li>
  );
}

function PlayerSection({
  title,
  players,
  currentPlayer,
  highestScorerIds,
  showDivider,
}: {
  title: string;
  players: Player[];
  currentPlayer?: Player;
  highestScorerIds: Set<string>;
  showDivider: boolean;
}) {
  if (players.length === 0) {
    return null;
  }

  return (
    <>
      {showDivider && (
        <div className="border-t border-gray-300 pt-2 mt-2">
          <h4 className="text-xs font-semibold text-base-content/70 mb-1.5">{title}</h4>
        </div>
      )}
      {players.map((player) => {
        const isCurrentPlayer = Boolean(currentPlayer && player.id === currentPlayer.id);
        const showTrophy = highestScorerIds.has(player.id);
        return (
          <PlayerItem
            key={player.id}
            player={player}
            isCurrentPlayer={isCurrentPlayer}
            showTrophy={showTrophy}
          />
        );
      })}
    </>
  );
}

export default function PlayersLobby({
  notGuessedPlayers,
  waitingPlayers = [],
  guessedPlayers = [],
  currentPlayer,
  minPlayers = 2,
}: PlayersLobbyProps) {
  // Collect all players to find highest scorer
  const allPlayers = [...notGuessedPlayers, ...waitingPlayers, ...guessedPlayers];

  // Find the highest points value across all players
  const highestPoints =
    allPlayers.length > 0 ? Math.max(...allPlayers.map((player) => player.points)) : 0;

  // Find all players with the highest points (only if highestPoints > 0)
  const highestScorerIds = new Set<string>();
  if (highestPoints > 0) {
    allPlayers.forEach((player) => {
      if (player.points === highestPoints) {
        highestScorerIds.add(player.id);
      }
    });
  }

  // Calculate sections (arrays come pre-sorted from parent)
  const nowGuessing = waitingPlayers.length > 0 ? [waitingPlayers[0]] : [];
  const nextGuessing = waitingPlayers.length > 1 ? waitingPlayers.slice(1) : [];

  // Check if we should show headers (if any players are in waiting or guessed states)
  const hasActiveGuessing = waitingPlayers.length > 0 || guessedPlayers.length > 0;

  // Total player count for empty state and min players check
  const totalPlayers = allPlayers.length;

  return (
    <Card
      className="w-full max-w-md max-h-[60vh] flex flex-col"
      bodyClassName="flex flex-col flex-1 gap-3 overflow-hidden"
    >
      {totalPlayers === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-3">
          <div className="text-3xl mb-2">👥</div>
          <p className="text-xs text-base-content/60">Waiting for players...</p>
        </div>
      ) : (
        <ul className="space-y-1.5 overflow-y-auto flex-1 min-h-0 pr-1">
          {hasActiveGuessing ? (
            <>
              {nowGuessing.length > 0 && (
                <PlayerSection
                  title="Now guessing"
                  players={nowGuessing}
                  currentPlayer={currentPlayer}
                  highestScorerIds={highestScorerIds}
                  showDivider={true}
                />
              )}
              {nextGuessing.length > 0 && (
                <PlayerSection
                  title="Next guessing"
                  players={nextGuessing}
                  currentPlayer={currentPlayer}
                  highestScorerIds={highestScorerIds}
                  showDivider={true}
                />
              )}
              {notGuessedPlayers.length > 0 && (
                <PlayerSection
                  title="Not guessing"
                  players={notGuessedPlayers}
                  currentPlayer={currentPlayer}
                  highestScorerIds={highestScorerIds}
                  showDivider={true}
                />
              )}
              {guessedPlayers.length > 0 && (
                <PlayerSection
                  title="Already guessed"
                  players={guessedPlayers}
                  currentPlayer={currentPlayer}
                  highestScorerIds={highestScorerIds}
                  showDivider={true}
                />
              )}
            </>
          ) : (
            // When no active guessing, show all players without headers/dividers
            notGuessedPlayers.map((player) => {
              const isCurrentPlayer = Boolean(currentPlayer && player.id === currentPlayer.id);
              const showTrophy = highestScorerIds.has(player.id);
              return (
                <PlayerItem
                  key={player.id}
                  player={player}
                  isCurrentPlayer={isCurrentPlayer}
                  showTrophy={showTrophy}
                />
              );
            })
          )}
        </ul>
      )}

      {totalPlayers < minPlayers && (
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
