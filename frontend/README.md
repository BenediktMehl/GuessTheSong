# Frontend (PWA)

The frontend is a React + TypeScript Progressive Web App that handles every player-facing screen as well as the host controls. Branding strings such as the app title and manifest metadata read from `../app-config/base.json`, which currently ships with the "Guess The Song" default. It talks to the backend WebSocket server for real-time updates and uses Spotify OAuth for music playback.

## Key Features

- **Host Settings Spotify login** – Hosts can authenticate with Spotify without leaving the settings screen. Successful logins redirect back to `/settings` automatically.
- **Shared card system** – All card-like UI elements (game code, player lists, status panels, etc.) are rendered through `src/components/Card.tsx` to keep styling consistent across the app.
- **Forced light theme** – The app fixes the theme to light mode to guarantee readable contrast on every device regardless of OS preference.

## Development

```bash
npm install
npm run dev
```

The dev server listens on `http://127.0.0.1:5173` so that the Spotify redirect URI works without additional configuration.

## Environment Variables

Create `.env.local` at the repository root (not in the `frontend/` folder) by copying `.env.example`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual values. See `.env.example` for all available environment variables.

The backend HTTP URL is automatically derived from the WebSocket URL (converting `ws://` to `http://` and `wss://` to `https://`). This works correctly even when the frontend and backend are on different domains (e.g., frontend on `guess-my-song.de`, backend on `guess-the-song.duckdns.org`), since the WebSocket URL points to the backend domain. If you need to override the backend HTTP URL separately, you can set `VITE_BACKEND_URL`.

### Spotify OAuth Configuration

**Development**: Register `http://127.0.0.1:5173/spotifycallback` in the Spotify Developer Dashboard.

**Production**: Register your production redirect URI (e.g., `https://your-domain.com/spotifycallback`) in the Spotify Developer Dashboard. The redirect URI is automatically determined based on the current origin in production.

The login flow stores tokens in `localStorage` and broadcasts login state over the WebSocket connection.

Production builds default to `wss://guess-the-song.duckdns.org:8080`. Override `VITE_WS_URL` if you deploy the backend under a different host or port.

## Testing

Run the Vitest suite:

```bash
npm test
```

## Notable Directories

- `src/components/` – Reusable UI elements (GameCode, PlayersLobby, Card, etc.)
- `src/pages/` – Routed screens for hosts, music hosts, and players
- `src/game/` – Client-side WebSocket integration and game state management

Follow the repository-wide guidelines in `plans/` when adding new UI or flows.
