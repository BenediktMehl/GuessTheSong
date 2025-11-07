# Backend

This Node.js WebSocket server powers the multiplayer music quiz experience. The user-facing name defaults to the `displayName` defined in `../app-config/base.json` (currently "Guess The Song").

## Features

- Room creation and management
- Real-time signaling and game state via WebSockets
- Minimal backend: no audio streaming, no game logic, only events

## Development

1. Install dependencies:
   ```
   npm install
   ```
2. Create `.env.local` at the repository root (not in the `backend/` folder) by copying `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` with your actual values.
3. Start the server:
   ```
   npm start
   ```
4. Run tests:
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

Use `wscat -c ws://localhost:8080` to connect locally and test commands manually. In production, the server listens on `wss://guess-the-song.duckdns.org:8080` once TLS is enabled.

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

## Environment Variables

All environment variables are loaded from `.env.local` at the repository root. The following variables are supported:

- `SPOTIFY_CLIENT_ID` - Spotify Client ID for token exchange (required for Spotify integration)
- `SPOTIFY_CLIENT_SECRET` - Spotify Client Secret for token exchange (required for Spotify integration)
- `PORT` - Server port (default: `8080`)
- `HOST` - Server host (default: `0.0.0.0`)
- `WS_USE_TLS` - Enable TLS for WebSocket connections (default: `false`)
- `WS_TLS_CERT_PATH` - Path to TLS certificate file (required if `WS_USE_TLS=true`)
- `WS_TLS_KEY_PATH` - Path to TLS private key file (required if `WS_USE_TLS=true`)
- `WS_ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `NODE_ENV` - Node environment (default: `development`)

## TLS Configuration

Set the following environment variables in your root `.env.local` when you want the backend to accept secure WebSocket connections directly:

- `WS_USE_TLS=true`
- `WS_TLS_CERT_PATH=/path/to/fullchain.pem`
- `WS_TLS_KEY_PATH=/path/to/privkey.pem`

Certificates must be readable by the Node.js process inside the container (mount them read-only via Docker volumes). When these variables are not provided, the server falls back to plain `ws://` which is suitable for local development.

Use the `docker-compose.tls.yml` overlay to mount LetsEncrypt certificates on the Raspberry Pi:

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
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

See the root `README.md` and `docs/ARD/GuessTheSong-ARD.md` for architecture and requirements (the document title keeps the historical name).