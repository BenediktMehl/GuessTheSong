import { useState } from "react";
import { useGameContext } from "../game/context";
import { joinGame } from "../game/player";

export default function Join() {
  const [room, setRoom] = useState('');
  const [nickname, setNickname] = useState('');
  const [joinFailed, setJoinFailed] = useState(false);
  const gameContext = useGameContext();

  const handleJoin = (e: React.FormEvent) => {
    const playerName = nickname.trim();
    const sessionId = room.trim().toUpperCase();
    e.preventDefault();

    if (playerName && sessionId) {
      joinGame(gameContext, playerName, sessionId).then(success => {
        if (success) {
          window.location.href = '/play'
        } else {
          setJoinFailed(true);
          setTimeout(() => setJoinFailed(false), 2000);
        }
      });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl mb-4 text-center">Join Game</h2>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Room Code</span>
              </label>
              <input
                type="text"
                value={room}
                onChange={e => setRoom(e.target.value.toUpperCase())}
                maxLength={6}
                required
                className="input input-bordered uppercase tracking-widest text-lg text-center"
                style={{ textTransform: 'uppercase' }}
                placeholder="A1B2"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Nickname</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                maxLength={16}
                required
                className="input input-bordered text-lg text-center"
                placeholder="Your name"
              />
            </div>
            <button type="submit" className="btn btn-success">Join</button>
          </form>
          {joinFailed && (
            <div className="toast toast-top toast-center mt-4">
              <div className="alert alert-error">
                <span>Failed to join the game. Please check the room code and try again.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}