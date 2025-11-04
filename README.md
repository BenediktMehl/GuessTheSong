# Guess The Song (configurable)

This repository hosts a real-time, multiplayer music quiz powered by Spotify. All branding strings (app title, manifest metadata, share text, etc.) originate from `app-config/base.json`, which defaults to "Guess The Song". Update that file to rebrand the app without hunting for scattered string literals. The web app runs across desktop and mobile browsers and uses WebSockets to keep every player in sync.

## Repository Layout

- `frontend/` – React + TypeScript PWA for the host, music host, and players
- `backend/` – Node.js WebSocket server that manages sessions, scores, and events
- `plans/` – Lightweight design and work-in-progress notes for new features and fixes

## Prerequisites

- Node.js 20+
- Spotify Developer account and app credentials (for OAuth)

## Quick Start

Install dependencies once per workspace:

```bash
npm install           # root hooks
cd backend && npm install
cd ../frontend && npm install
```

Run the services in separate terminals:

```bash
cd backend && npm start
cd frontend && npm run dev
```

The frontend dev server is served from `http://127.0.0.1:5173` so the Spotify redirect works out of the box.

During local development the backend listens on `ws://localhost:8080`. Production builds automatically switch to `wss://` to stay compatible with HTTPS hosting.

## Spotify OAuth Configuration

The frontend expects a Spotify client ID via Vite. Create `frontend/.env.local` and add:

```ini
VITE_SPOTIFY_CLIENT_ID=your_client_id
```

Register the redirect URI `http://127.0.0.1:5173/spotifycallback` in the Spotify Developer Dashboard. Hosts can now log in to Spotify directly from the Host Settings screen.

## Frontend UX Notes

- Cards across the UI (game code, lobbies, Spotify login, etc.) share the `Card` component in `frontend/src/components/Card.tsx` for consistent styling.
- The UI enforces the light theme regardless of the system preference to preserve contrast and readability on all devices.

## Tests

- Backend (Jest): `cd backend && npm test`
- Frontend (Vitest): `cd frontend && npm test`
- Branding guard: `node scripts/check-brand.js`

Please follow the workflow in `plans/` when starting new features or fixes.

## Production Deployment (Raspberry Pi)

- Certificates from Let's Encrypt live at `/etc/letsencrypt/live/guess-the-song.duckdns.org/` on the Pi.
- Use Docker Compose with the TLS overlay to mount certs and enable secure WebSockets:

	```bash
	cd backend
	docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
	```

- Required environment variables:
	- `WS_USE_TLS=true`
	- `WS_TLS_CERT_PATH=/certs/fullchain.pem`
	- `WS_TLS_KEY_PATH=/certs/privkey.pem`

After the stack is up the backend is reachable at `wss://guess-the-song.duckdns.org:8080` and pairs cleanly with the HTTPS frontend.