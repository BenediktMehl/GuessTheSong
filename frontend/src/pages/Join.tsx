import React, { useState } from 'react'

export default function Join() {
  const [room, setRoom] = useState('')
  const [nickname, setNickname] = useState('')

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement join room logic
    alert(`Joining room: ${room} as ${nickname}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-200">
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
                placeholder="ABC123"
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
                className="input input-bordered"
                placeholder="Your name"
              />
            </div>
            <button type="submit" className="btn btn-primary mt-2">
              Join
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}