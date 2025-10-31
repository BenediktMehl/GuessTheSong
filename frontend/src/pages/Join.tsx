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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-3xl mb-6 text-center justify-center">Join Game</h2>
          <form onSubmit={handleJoin} className="flex flex-col gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-lg font-semibold">Room Code</span>
              </label>
              <input
                type="text"
                value={room}
                onChange={e => setRoom(e.target.value.toUpperCase())}
                maxLength={6}
                required
                className="input input-bordered input-lg uppercase tracking-widest text-center font-mono text-2xl mt-2"
                style={{ textTransform: 'uppercase' }}
                placeholder="A1B2"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-lg font-semibold">Your Name</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                maxLength={16}
                required
                className="input input-bordered input-lg text-center text-xl mt-2"
                placeholder="Enter your name"
              />
            </div>
            <button type="submit" className="btn btn-success btn-lg text-lg mt-2">
              🎮 Join Game
            </button>
          </form>
          {joinFailed && (
            <div className="toast toast-top toast-center">
              <div className="alert alert-error">
                <span>❌ Failed to join. Check the room code.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}