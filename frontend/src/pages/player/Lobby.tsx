import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import GameCode from '../../components/GameCode';
import PlayersLobby from '../../components/PlayersLobby';
import { useGameContext } from '../../game/context';
import { leaveGame } from '../../game/player';

export default function PlayerLobby() {
  const gameContext = useGameContext();
  const { sessionId, players, status, currentPlayerId, wsStatus } = gameContext;
  const navigate = useNavigate();

  const handleLeaveLobby = () => {
    leaveGame(gameContext);
    navigate('/join');
  };

  // When the game starts, switch to the play view
  useEffect(() => {
    if (status === 'waiting' || status === 'listening' || status === 'guessing') {
      navigate('/play');
    }
  }, [status, navigate]);

  // If no session, go back to join
  useEffect(() => {
    if (!sessionId) {
      navigate('/join');
    }
  }, [sessionId, navigate]);

  return (
    <main className="h-screen flex flex-col items-center justify-center p-4 gap-4 overflow-hidden">
      {wsStatus === 'connecting' || wsStatus === 'closed' ? (
        <div className="alert alert-warning max-w-md flex flex-col gap-2">
          <div>
            <span className="loading loading-spinner loading-sm mr-2"></span>
            <span className="font-semibold">Establishing connection...</span>
          </div>
          <p className="text-sm">
            Please wait while the connection to the server is being established.
          </p>
        </div>
      ) : wsStatus === 'failed' ? (
        <div className="alert alert-error max-w-md flex flex-col gap-3">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6 inline mr-2"
              fill="none"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Error"
            >
              <title>Error</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-semibold">Connection could not be established.</span>
          </div>
          <p className="text-sm">Please reload the page or try again later.</p>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              🔄 Reload
            </button>
            <button
              type="button"
              onClick={handleLeaveLobby}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              ← Back
            </button>
          </div>
        </div>
      ) : (
        <>
          {sessionId && <GameCode sessionId={sessionId} showCopyLink={false} />}

          <PlayersLobby
            notGuessedPlayers={[...(players || [])].sort((a, b) => b.points - a.points)}
            minPlayers={2}
            currentPlayer={
              currentPlayerId ? (players || []).find((p) => p.id === currentPlayerId) : undefined
            }
          />

          <Card className="w-full max-w-md text-center" bodyClassName="items-center gap-2">
            <div className="text-3xl animate-bounce">⏳</div>
            <p className="text-sm font-semibold">Waiting for host to start the game...</p>
          </Card>

          <button
            type="button"
            onClick={handleLeaveLobby}
            className="btn btn-sm btn-outline btn-error"
          >
            Leave Lobby
          </button>
        </>
      )}
    </main>
  );
}
