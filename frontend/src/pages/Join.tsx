import { useEffect, useState } from "react";
import { useGameContext } from "../game/context";
import { joinGame } from "../game/player";

export default function Join() {
  const [room, setRoom] = useState('');
  const [nickname, setNickname] = useState('');
  const [joinFailed, setJoinFailed] = useState(false);
  const gameContext = useGameContext();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('id');
    if (roomId) {
      setRoom(roomId.toUpperCase());
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    const playerName = nickname.trim();
    const sessionId = room.trim().toUpperCase();
    e.preventDefault();

    if (playerName && sessionId) {
      joinGame(gameContext, playerName, sessionId).then(success => {
        if (success) {
          window.location.href = '/lobby'  // Zu Lobby statt direkt zu /play
        } else {
          setJoinFailed(true);
          setTimeout(() => setJoinFailed(false), 2000);
        }
      });
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <h1 className="text-4xl font-bold text-success mb-2">Join Game</h1>
      <p className="text-lg text-base-content mb-4">Enter the game code to join your friends!</p>

      <div className="card bg-base-200 shadow-xl p-6 w-full max-w-md">
        <form onSubmit={handleJoin} className="flex flex-col gap-6">
          <div className="form-control">
            <label className="label justify-center">
              <span className="label-text text-xl font-semibold">Game Code</span>
            </label>
            <input
              type="text"
              value={room}
              onChange={e => setRoom(e.target.value.toUpperCase())}
              maxLength={6}
              required
              className="input input-bordered input-lg uppercase tracking-[0.5em] text-center font-mono text-4xl font-bold text-primary bg-base-300"
              style={{ textTransform: 'uppercase' }}
              placeholder="A1B2"
              autoFocus
            />
          </div>

          <div className="divider">AND</div>

          <div className="form-control">
            <label className="label justify-center">
              <span className="label-text text-xl font-semibold">Your Name</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              maxLength={16}
              required
              className="input input-bordered input-lg text-center text-2xl bg-base-300"
              placeholder="Enter your name"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-success btn-lg text-xl mt-4"
          >
            🎮 Join Game
          </button>
        </form>
      </div>

      <a href="/" className="btn btn-outline btn-ghost">
        ← Back to Home
      </a>

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