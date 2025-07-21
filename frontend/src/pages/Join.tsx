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
    <main>
      <h2>Join Game</h2>
      <form onSubmit={handleJoin}>
        <label>
          Room Code:
          <input
            value={room}
            onChange={e => setRoom(e.target.value.toUpperCase())}
            maxLength={6}
            required
            style={{ textTransform: 'uppercase' }}
          />
        </label>
        <br />
        <label>
          Nickname:
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={16}
            required
          />
        </label>
        <br />
        <button type="submit">Join</button>
      </form>
    </main>
  )
}