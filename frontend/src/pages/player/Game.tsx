import appConfig from '@app-config';
import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import PlayersLobby from '../../components/PlayersLobby';
import { useGameContext } from '../../game/context';

export default function Game() {
  const { players, currentPlayerId, waitingPlayers, guessedPlayers } = useGameContext();

  // Calculate notGuessedPlayers (players not in waiting or guessed arrays)
  const waitingPlayerIds = new Set((waitingPlayers || []).map((p) => p.id));
  const guessedPlayerIds = new Set((guessedPlayers || []).map((p) => p.id));
  const notGuessedPlayers = (players || [])
    .filter((p) => !waitingPlayerIds.has(p.id) && !guessedPlayerIds.has(p.id))
    .sort((a, b) => b.points - a.points);

  // Find currentPlayer object from currentPlayerId
  const allPlayers = [
    ...(players || []),
    ...(waitingPlayers || []),
    ...(guessedPlayers || []),
  ];
  const currentPlayer = currentPlayerId
    ? allPlayers.find((p) => p.id === currentPlayerId)
    : undefined;
  const [position, setPosition] = useState<number>(-1);
  const [guesser, setGuesser] = useState<string | null>(null);
  const [showJoinedToast, setShowJoinedToast] = useState(true);

  useEffect(() => {
    if (showJoinedToast) {
      const timer = setTimeout(() => setShowJoinedToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showJoinedToast]);

  const guessSong = () => {
    // Random position between -1 and 2
    const randomPosition = Math.floor(Math.random() * 4) - 1;
    // Random 3-digit string
    const randomPlayerName = Math.floor(100 + Math.random() * 900).toString();
    setPosition(randomPosition);
    setGuesser(randomPlayerName);
    console.log(randomPosition, randomPlayerName);
  };

  const getGameStateContent = () => {
    if (position === 0) {
      return {
        title: 'Your Turn!',
        content: (
          <>
            <p className="text-lg font-semibold text-primary">It is now your turn to</p>
            <p className="text-3xl font-bold text-primary">{appConfig.displayName}</p>
          </>
        ),
      };
    }

    if (guesser) {
      if (position > 0) {
        return {
          title: 'Waiting for Your Turn',
          content: (
            <>
              <p className="text-lg font-semibold text-base-content/80">
                It is {guesser}'s turn to
              </p>
              <p className="text-2xl font-bold text-primary">{appConfig.displayName}</p>
              <p className="text-sm text-base-content/70 mt-2">
                It is your turn after {position > 1 ? `${position} players` : 'him/her'}!
              </p>
            </>
          ),
        };
      }
      return {
        title: 'Waiting for Your Turn',
        content: (
          <>
            <p className="text-lg font-semibold text-base-content/80">It is {guesser}'s turn to</p>
            <p className="text-2xl font-bold text-primary">{appConfig.displayName}</p>
            <p className="text-sm text-base-content/70 mt-2">Press the screen to guess next!</p>
          </>
        ),
      };
    }

    return {
      title: 'Ready to Play',
      content: (
        <>
          <p className="text-lg font-semibold text-base-content/80">Press the screen to</p>
          <p className="text-3xl font-bold text-primary">{appConfig.displayName}</p>
        </>
      ),
    };
  };

  const gameState = getGameStateContent();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      {showJoinedToast && (
        <div className="toast toast-top toast-center">
          <div className="alert alert-success">
            <span>Successfully joined the game!</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-md flex flex-col gap-6">
        <Card className="w-full" bodyClassName="items-center text-center gap-2">
          <button
            type="button"
            onClick={guessSong}
            className="cursor-pointer w-full text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded bg-white"
            aria-label={gameState.title}
          >
            {gameState.content}
          </button>
        </Card>

        <PlayersLobby
          notGuessedPlayers={notGuessedPlayers}
          waitingPlayers={waitingPlayers}
          guessedPlayers={guessedPlayers}
          currentPlayer={currentPlayer}
        />
      </div>
    </main>
  );
}
