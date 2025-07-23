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

All messages follow this simplified format:

```javascript
{
  "action": String,  // Specific command or event
  "payload": Object  // Data relevant to the action
}
```

## Commands for Manual Testing

Use `wscat -c ws://localhost:8080` to connect and test commands manually.

### Host Commands

Create a new game session:
```json
{"action": "create"}
```

Broadcast game state to all players:
```json
{"action": "broadcast", "payload": {"action": "update", "data": {"status": "listening", "currentTrack": "Song X"}}}
```

### Player Commands

Join a session:
```json
{"action": "join", "payload": {"sessionId": "C661", "name": "Alice"}}
```

Signal wanting to guess:
```json
{"action": "wantToGuess", "payload": {}}
```

Submit a guess:
```json
{"action": "guessed", "payload": {"guess": "Song Title"}}
```

Change music host:
```json
{"action": "musicHostChanged", "payload": {"musicHostId": "player-123"}}
```

Change referee:
```json
{"action": "refereeChanged", "payload": {"refereeId": "player-456"}}
```

## Server Responses

### Host Responses

Session created:
```json
{"action": "created", "payload": {"sessionId": "A1B2"}}
```

Player joined:
```json
{"action": "player-joined", "payload": {"name": "Alice", "playerId": "uuid-123"}}
```

Player left:
```json
{"action": "player-left", "payload": {"name": "Alice", "playerId": "uuid-123"}}
```

Player action forwarded:
```json
{"action": "guessed", "payload": {"guess": "Song A", "playerId": "uuid-123", "playerName": "Alice", "serverTimestamp": 1626987654321}}
```

### Player Responses

Join success:
```json
{"action": "join-success", "payload": {"sessionId": "A1B2", "playerId": "uuid-123"}}
```

Join failed:
```json
{"action": "join-failed", "payload": {"reason": "Session does not exist."}}
```

Host broadcast:
```json
{"action": "update", "payload": {"status": "listening", "currentTrack": "Song X"}}
```

## Error Handling

Invalid JSON:
```json
{"action": "error", "payload": {"message": "Could not interpret the command (invalid JSON)."}}
```

Session error:
```json
{"action": "error", "payload": {"message": "Session does not exist."}}
```

See the root `README.md` and `docs/ARD/GuessTheSong-ARD.md` for architecture and requirements.