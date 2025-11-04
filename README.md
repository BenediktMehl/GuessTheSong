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