# GuessTheSong Backend

This is the Node.js WebSocket server for GuessTheSong.

## Features

- Room creation and management
- Real-time signaling and game state via WebSockets
- Minimal backend: no audio streaming, no game logic, only events

## Development

1. Install dependencies:
   ```
   npm install
   ```
2. Start the server:
   ```
   npm start
   ```

See the root [`README.md`](../README.md) and [`docs/ARD/GuessTheSong-ARD.md`](../docs/ARD/GuessTheSong-ARD.md) for architecture and requirements.

## Commands for manual testing

wscat -c ws://localhost:8080

### Host
{"type": "create"}
{"type": "host-broadcast", "payload": {"state": "next-turn", "guesser": "Player1"}}

### Player
{"type": "join", "sessionId": "ABCD", "payload": {"name": "Alice"}}
{"type": "player-action", "payload": {"action": "guess", "value": "Song Title"}}