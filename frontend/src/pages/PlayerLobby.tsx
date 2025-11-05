import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import GameCode from '../components/GameCode';
import PlayersLobby from '../components/PlayersLobby';
import { useGameContext } from '../game/context';

export default function PlayerLobby() {
  const { sessionId, players, status, currentPlayerId, wsStatus } = useGameContext();
  const navigate = useNavigate();

  // Wenn das Spiel startet, zur Play-Ansicht wechseln
  useEffect(() => {
    if (status === 'waiting' || status === 'listening' || status === 'guessing') {
      navigate('/play');
    }
  }, [status, navigate]);

  // Wenn keine Session, zurück zum Join
  useEffect(() => {
    if (!sessionId) {
      navigate('/join');
    }
  }, [sessionId, navigate]);

  return (
    <main className="h-screen flex flex-col items-center justify-center p-4 gap-4 overflow-hidden">
      <h1 className="text-2xl md:text-4xl font-bold text-primary">Lobby</h1>

      {wsStatus === 'connecting' || wsStatus === 'closed' ? (
        <div className="alert alert-warning max-w-md flex flex-col gap-2">
          <div>
            <span className="loading loading-spinner loading-sm mr-2"></span>
            <span className="font-semibold">Stelle Verbindung her...</span>
          </div>
          <p className="text-sm">Bitte warten, während die Verbindung zum Server aufgebaut wird.</p>
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
            <span className="font-semibold">Verbindung konnte nicht aufgebaut werden.</span>
          </div>
          <p className="text-sm">Bitte lade die Seite neu oder versuche es später nochmal.</p>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              🔄 Neu laden
            </button>
            <button
              type="button"
              onClick={() => navigate('/join')}
              className="btn btn-outline btn-sm flex-1 whitespace-nowrap"
            >
              ← Zurück
            </button>
          </div>
        </div>
      ) : (
        <>
          {sessionId && <GameCode sessionId={sessionId} showCopyLink={false} />}

          <PlayersLobby players={players} minPlayers={2} currentPlayerId={currentPlayerId} />

          <Card className="w-full max-w-md text-center" bodyClassName="items-center gap-2">
            <div className="text-3xl animate-bounce">⏳</div>
            <p className="text-sm font-semibold">Waiting for host to start the game...</p>
            <p className="text-xs text-base-content/60">Share the game code!</p>
          </Card>

          <button
            type="button"
            onClick={() => navigate('/join')}
            className="btn btn-sm btn-outline btn-error"
          >
            Leave Lobby
          </button>
        </>
      )}
    </main>
  );
}
