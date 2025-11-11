import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { useGameContext } from '../../game/context';
import { getRandomFunnyName } from '../../game/names';
import { joinGame } from '../../game/player';
import { clearPlayerData, getPlayerData } from '../../utils/playerStorage';

export default function Join() {
  const [room, setRoom] = useState('');
  const [nickname, setNickname] = useState('');
  const [joinFailed, setJoinFailed] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const gameContext = useGameContext();
  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('id');
    if (roomId) {
      setRoom(roomId.toUpperCase());
    }
  }, []);

  // Auto-reconnect on page load if stored data exists
  useEffect(() => {
    // Only attempt once
    if (hasAttemptedReconnect.current) {
      return;
    }

    const storedData = getPlayerData();
    if (storedData && !room) {
      // Only auto-reconnect if no room code is provided (user didn't manually enter one)
      hasAttemptedReconnect.current = true;
      setIsReconnecting(true);
      joinGame(gameContext, storedData.playerName, storedData.sessionId, storedData.playerId)
        .then((result) => {
          setIsReconnecting(false);
          if (result.success) {
            // Check if game is already running - if so, navigate directly to play screen
            if (
              result.status === 'waiting' ||
              result.status === 'listening' ||
              result.status === 'guessing'
            ) {
              navigate('/play');
            } else {
              navigate('/lobby');
            }
          } else {
            // Session doesn't exist, clear stored data
            clearPlayerData();
            setIsReconnecting(false);
          }
        })
        .catch(() => {
          setIsReconnecting(false);
          clearPlayerData();
        });
    } else {
      hasAttemptedReconnect.current = true;
    }
  }, [gameContext, navigate, room]);

  const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setRoom(value);

    // Auto-focus on name when 4 characters are entered
    if (value.length === 4) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();

    // If no name was entered, generate a random name
    const playerName = nickname.trim() || getRandomFunnyName();
    const sessionId = room.trim().toUpperCase();

    if (sessionId) {
      // Check if we have stored data for this session
      const storedData = getPlayerData();
      const playerId =
        storedData && storedData.sessionId === sessionId ? storedData.playerId : undefined;

      joinGame(gameContext, playerName, sessionId, playerId).then((result) => {
        if (result.success) {
          // Check if game is already running - if so, navigate directly to play screen
          if (
            result.status === 'waiting' ||
            result.status === 'listening' ||
            result.status === 'guessing'
          ) {
            navigate('/play');
          } else {
            navigate('/lobby');
          }
        } else {
          // If join failed and it was a reconnection attempt, clear stored data
          if (playerId && storedData) {
            clearPlayerData();
          }
          setJoinFailed(true);
          setTimeout(() => setJoinFailed(false), 2000);
        }
      });
    }
  };

  if (isReconnecting) {
    return (
      <main className="h-screen flex flex-col items-center justify-center p-2 sm:p-4 gap-2 sm:gap-4">
        <Card className="w-full max-w-md" bodyClassName="gap-3 sm:gap-4">
          <p className="text-xs sm:text-sm text-base-content text-center">
            Reconnecting to your game...
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col items-center justify-start p-2 sm:p-4 gap-2 sm:gap-4 overflow-y-auto">
      <Card className="w-full max-w-md" bodyClassName="gap-3 sm:gap-4">
        <p className="text-xs sm:text-sm text-base-content text-center">
          Enter the game code to join a game
        </p>
        <form onSubmit={handleJoin} className="flex flex-col gap-3 sm:gap-4">
          <div className="form-control">
            <label htmlFor="game-code" className="label justify-center py-1">
              <span className="label-text text-xs sm:text-sm font-semibold">Game Code</span>
            </label>
            <input
              id="game-code"
              type="text"
              value={room}
              onChange={handleRoomChange}
              maxLength={4}
              required
              className="input input-bordered input-sm sm:input-md uppercase tracking-[0.5em] text-center font-mono text-2xl sm:text-3xl font-bold text-primary bg-white shadow-lg"
              style={{ textTransform: 'uppercase' }}
              placeholder="A1B2"
              inputMode="text"
            />
          </div>

          <div className="divider my-1 text-xs">AND</div>

          <div className="form-control">
            <label htmlFor="player-name" className="label justify-center py-1">
              <span className="label-text text-xs sm:text-sm font-semibold">Your Name</span>
            </label>
            <input
              id="player-name"
              ref={nameInputRef}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={16}
              className="input input-bordered input-sm sm:input-md text-center text-base sm:text-lg bg-white shadow-lg"
              placeholder="Enter your name"
              inputMode="text"
            />
          </div>

          <button
            type="submit"
            className="btn btn-success btn-sm sm:btn-md text-sm sm:text-base mt-2 shadow-xl"
            disabled={room.length !== 4}
          >
            🎮 Join Game
          </button>
        </form>
      </Card>

      <button
        type="button"
        onClick={() => navigate('/')}
        className="btn btn-xs sm:btn-sm btn-outline btn-ghost mt-4 sm:mt-8"
      >
        ← Back to Home
      </button>

      {joinFailed && (
        <div className="toast toast-top toast-center">
          <div className="alert alert-error shadow-2xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
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
            <span>Failed to join. Check the game code and try again.</span>
          </div>
        </div>
      )}
    </main>
  );
}
