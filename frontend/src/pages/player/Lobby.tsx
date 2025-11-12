import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackendOffline } from '../../components/BackendOffline';
import { Card } from '../../components/Card';
import GameCode from '../../components/GameCode';
import { InstallPrompt } from '../../components/InstallPrompt';
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
        <BackendOffline onReload={() => window.location.reload()} onBack={handleLeaveLobby} />
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
      <InstallPrompt />
    </main>
  );
}
