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

## Environment Variables

Create `.env.local` at the repository root (not in `frontend/` or `backend/`) using the setup script:

```bash
node setup-env.js <client-id> <client-secret>
```

Or manually copy `.env.example` and edit it:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your actual values. See `.env.example` for all available environment variables.

## Spotify OAuth Configuration

Register the redirect URI `http://127.0.0.1:5173/spotifycallback` in the Spotify Developer Dashboard. Hosts can now log in to Spotify directly from the Host Settings screen.

## Frontend UX Notes

- Cards across the UI (game code, lobbies, Spotify login, etc.) share the `Card` component in `frontend/src/components/Card.tsx` for consistent styling.
- The UI enforces the light theme regardless of the system preference to preserve contrast and readability on all devices.

### PlayersLobby Component

The `PlayersLobby` component displays players organized into four sections based on their guessing state. The component expects pre-sorted arrays from the parent - it does not perform any sorting internally.

**Props:**
- `notGuessedPlayers: Player[]` - Players who haven't guessed yet, pre-sorted by points (highest first)
- `waitingPlayers?: Player[]` - Players in the guessing queue, pre-sorted (first player is "now guessing", rest are "next guessing")
- `guessedPlayers?: Player[]` - Players who have already guessed, pre-sorted by points (highest first)
- `currentPlayer?: Player` - The current player object (for highlighting)
- `minPlayers?: number` - Minimum number of players required (default: 2)

**Display Sections:**
1. **"Now guessing"** - The first player in `waitingPlayers` array
2. **"Next guessing"** - Remaining players in `waitingPlayers` array (maintains order)
3. **"Not guessing"** - Players in `notGuessedPlayers` array (pre-sorted by points)
4. **"Already guessed"** - Players in `guessedPlayers` array (pre-sorted by points)

**Visual Features:**
- Each section has a grey divider line and header label (only shown when the section contains players)
- The player with the highest points across all players displays a trophy icon (🏆) next to their name
- When no players are in active guessing states (no waiting or guessed players), all players are displayed in a simple list without headers or dividers
- The current player is highlighted with a green border and "(You)" label
- All arrays must be pre-sorted by the parent component in the order they should be displayed

## Linting and Formatting

The project uses [Biome](https://biomejs.dev/) for linting and formatting. Biome automatically runs on pre-commit and pre-push via Husky and lint-staged, and also in CI via GitHub Actions.

- **Lint**: `cd frontend && npm run lint` or `cd backend && npm run lint`
- **Format**: `cd frontend && npm run format` or `cd backend && npm run format`
- **Check (lint + format)**: `cd frontend && npm run check` or `cd backend && npm run check`
- **Auto-fix**: `cd frontend && npm run check:fix` or `cd backend && npm run check:fix`

Configuration is in `biome.json` at the root level.

## Tests

- Backend (Jest): `cd backend && npm test`
- Frontend (Vitest): `cd frontend && npm test`
- Branding guard: `node scripts/check-brand.js`

Please follow the workflow in `plans/` when starting new features or fixes.

## CodeCharta Analysis

This repository uses [CodeCharta](https://codecharta.com/) to visualize code complexity and structure. The analysis runs automatically via GitHub Actions when a pull request is merged into `main`.

### Accessing the Visualization

1. **Enable GitHub Pages** (one-time setup):
   - Go to Repository Settings → Pages
   - Source: `/docs` directory from `main` branch
   - Save the settings

2. **View the visualization**:
   - After each merged PR, the analysis is available at:
     - Direct file: `https://[username].github.io/[repo]/cc_metrics_MM_DD_YY.cc.json` (e.g., `cc_metrics_05_11_25.cc.json`)
     - CodeCharta Web Studio: `https://codecharta.com/web/?file=https://[username].github.io/[repo]/cc_metrics_MM_DD_YY.cc.json`
   - The workflow summary in GitHub Actions also contains direct links to the latest analysis file
   - Each analysis run creates a new date-stamped file (format: `cc_metrics_MM_DD_YY.cc.json`)

The analysis uses CodeCharta's unified parser to analyze the entire codebase (frontend and backend) and generates standard metrics for code complexity and structure.

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