import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGameContext } from "../game/context";
import { joinGame } from "../game/player";
import { getRandomFunnyName } from "../utils/names";

export default function Join() {
  const [room, setRoom] = useState('');
  const [nickname, setNickname] = useState('');
  const [joinFailed, setJoinFailed] = useState(false);
  const gameContext = useGameContext();
  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('id');
    if (roomId) {
      setRoom(roomId.toUpperCase());
    }
  }, []);

  const handleRoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setRoom(value);
    
    // Auto-focus auf Name wenn 4 Zeichen eingegeben sind
    if (value.length === 4) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Wenn kein Name eingegeben wurde, zufälligen Namen generieren
    const playerName = nickname.trim() || getRandomFunnyName();
    const sessionId = room.trim().toUpperCase();

    if (sessionId) {
      joinGame(gameContext, playerName, sessionId).then(success => {
        if (success) {
          navigate('/lobby');  // React Router Navigation statt window.location.href
        } else {
          setJoinFailed(true);
          setTimeout(() => setJoinFailed(false), 2000);
        }
      });
    }
  };

  return (
    <main className="h-screen flex flex-col items-center justify-start p-4 pt-8 gap-3 overflow-y-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-success">Join Game</h1>
      <p className="text-sm text-base-content">Enter the game code!</p>

      <div className="card bg-base-200 bg-opacity-70 shadow-2xl p-4 w-full max-w-md">
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label justify-center py-1">
              <span className="label-text text-sm font-semibold">Game Code</span>
            </label>
            <input
              type="text"
              value={room}
              onChange={handleRoomChange}
              maxLength={4}
              required
              className="input input-bordered input-md uppercase tracking-[0.5em] text-center font-mono text-3xl font-bold text-primary bg-base-300 bg-opacity-70"
              style={{ textTransform: 'uppercase' }}
              placeholder="A1B2"
              autoFocus
              inputMode="text"
            />
          </div>

          <div className="divider my-1 text-xs">AND</div>

          <div className="form-control">
            <label className="label justify-center py-1">
              <span className="label-text text-sm font-semibold">Your Name</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={16}
              className="input input-bordered input-md text-center text-lg bg-base-300 bg-opacity-70"
              placeholder="Enter your name"
              inputMode="text"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-success btn-md text-base mt-2"
          >
            🎮 Join Game
          </button>
        </form>
      </div>

      <button 
        onClick={() => navigate('/')} 
        className="btn btn-sm btn-outline btn-ghost mt-2"
      >
        ← Back to Home
      </button>

      {joinFailed && (
        <div className="toast toast-top toast-center">
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Failed to join. Check the game code and try again.</span>
          </div>
        </div>
      )}
    </main>
  );
}