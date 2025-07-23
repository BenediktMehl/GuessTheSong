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
3. Run tests:
   ```
   npm test
   ```

## WebSocket Message Format

All messages follow this format:

```javascript
{
  "type": String,    // Indicates message direction (player, host, host-broadcast, player-forward)
  "action": String,  // Specific command or event
  "payload": Object  // Data relevant to the action
}
```

### Message Types

- `player`: Messages sent from players to the server
- `host`: Messages sent from host to server or server to host/player
- `host-broadcast`: Messages broadcast from server to all players
- `player-forward`: Messages forwarded from player to host

## Commands for Manual Testing

Use `wscat -c ws://localhost:8080` to connect and test commands manually.

### Host Commands

Create a new game session:
```json
{"type": "host", "action": "create"}
```

Broadcast game state to all players:
```json
{"type": "host", "action": "broadcast", "payload": {"action": "update", "data": {"status": "listening", "currentTrack": "Song X"}}}
```

### Player Commands

Join a session:
```json
{"type": "player", "action": "join", "payload": {"sessionId": "C661", "name": "Alice"}}
```

Signal wanting to guess:
```json
{"type": "player", "action": "wantToGuess", "payload": {}}
```

Submit a guess:
```json
{"type": "player", "action": "guessed", "payload": {"guess": "Song Title"}}
```

Change music host:
```json
{"type": "player", "action": "musicHostChanged", "payload": {"musicHostId": "player-123"}}
```

Change referee:
```json
{"type": "player", "action": "refereeChanged", "payload": {"refereeId": "player-456"}}
```

## Server Responses

### Host Responses

Session created:
```json
{"type": "host", "action": "created", "payload": {"sessionId": "A1B2"}}
```

Player joined:
```json
{"type": "player-forward", "action": "player-joined", "payload": {"name": "Alice", "playerId": "uuid-123"}}
```

Player left:
```json
{"type": "player-forward", "action": "player-left", "payload": {"name": "Alice", "playerId": "uuid-123"}}
```

Player action forwarded:
```json
{"type": "player-forward", "action": "guessed", "payload": {"guess": "Song A", "playerId": "uuid-123", "playerName": "Alice", "serverTimestamp": 1626987654321}}
```

### Player Responses

Join success:
```json
{"type": "host", "action": "join-success", "payload": {"sessionId": "A1B2", "playerId": "uuid-123"}}
```

Join failed:
```json
{"type": "host", "action": "join-failed", "payload": {"reason": "Session does not exist."}}
```

Host broadcast:
```json
{"type": "host-broadcast", "action": "update", "payload": {"status": "listening", "currentTrack": "Song X"}}
```

## Error Handling

Invalid JSON:
```json
{"type": "host", "action": "error", "payload": {"message": "Could not interpret the command (invalid JSON)."}}
```

Session error:
```json
{"type": "host", "action": "error", "payload": {"message": "Session does not exist."}}
```

See the root `README.md` and `docs/ARD/GuessTheSong-ARD.md` for architecture and requirements.